const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../config/database');
const { authenticateToken, requireOwnershipOrRole } = require('../middleware/auth');

const router = express.Router();

// Get mood entries for a user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { userId = req.user.id } = req.query;
    const { page = 1, limit = 30, startDate, endDate } = req.query;
    const offset = (page - 1) * limit;

    // Check if user can access this data
    if (parseInt(userId) !== req.user.id && req.user.role !== 'therapist') {
      return res.status(403).json({ error: 'Access denied' });
    }

    let whereClause = 'WHERE user_id = ?';
    let params = [userId];

    if (startDate) {
      whereClause += ' AND date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND date <= ?';
      params.push(endDate);
    }

    const moodEntries = await new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM mood_entries 
        ${whereClause}
        ORDER BY date DESC, created_at DESC
        LIMIT ? OFFSET ?
      `;
      db.all(sql, [...params, limit, offset], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Get total count
    const totalCount = await new Promise((resolve, reject) => {
      const sql = `SELECT COUNT(*) as count FROM mood_entries ${whereClause}`;
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    res.json({
      moodEntries,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Get mood entries error:', error);
    res.status(500).json({ error: 'Failed to get mood entries' });
  }
});

// Add new mood entry
router.post('/', authenticateToken, [
  body('mood').isIn(['happy', 'sad', 'anxious', 'angry', 'tired', 'neutral']).withMessage('Invalid mood value'),
  body('intensity').isInt({ min: 1, max: 10 }).withMessage('Intensity must be between 1 and 10'),
  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes must be less than 500 characters'),
  body('date').optional().isISO8601().withMessage('Invalid date format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { mood, intensity, notes, date } = req.body;
    const entryDate = date || new Date().toISOString().split('T')[0];

    // Check if entry already exists for this date
    const existingEntry = await new Promise((resolve, reject) => {
      const sql = 'SELECT id FROM mood_entries WHERE user_id = ? AND date = ?';
      db.get(sql, [req.user.id, entryDate], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (existingEntry) {
      return res.status(400).json({ error: 'Mood entry already exists for this date' });
    }

    const entryId = await new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO mood_entries (user_id, mood, intensity, notes, date)
        VALUES (?, ?, ?, ?, ?)
      `;
      db.run(sql, [req.user.id, mood, intensity, notes, entryDate], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });

    // Get the created entry
    const moodEntry = await new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM mood_entries WHERE id = ?';
      db.get(sql, [entryId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    res.status(201).json({
      message: 'Mood entry added successfully',
      moodEntry
    });

  } catch (error) {
    console.error('Add mood entry error:', error);
    res.status(500).json({ error: 'Failed to add mood entry' });
  }
});

// Update mood entry
router.put('/:entryId', authenticateToken, [
  body('mood').optional().isIn(['happy', 'sad', 'anxious', 'angry', 'tired', 'neutral']).withMessage('Invalid mood value'),
  body('intensity').optional().isInt({ min: 1, max: 10 }).withMessage('Intensity must be between 1 and 10'),
  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes must be less than 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { entryId } = req.params;
    const { mood, intensity, notes } = req.body;

    // Check if entry exists and belongs to user
    const existingEntry = await new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM mood_entries WHERE id = ? AND user_id = ?';
      db.get(sql, [entryId, req.user.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!existingEntry) {
      return res.status(404).json({ error: 'Mood entry not found' });
    }

    // Build update query
    const updates = [];
    const values = [];

    if (mood !== undefined) {
      updates.push('mood = ?');
      values.push(mood);
    }
    if (intensity !== undefined) {
      updates.push('intensity = ?');
      values.push(intensity);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(entryId);

    const sql = `UPDATE mood_entries SET ${updates.join(', ')} WHERE id = ?`;
    
    await new Promise((resolve, reject) => {
      db.run(sql, values, function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });

    // Get updated entry
    const updatedEntry = await new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM mood_entries WHERE id = ?';
      db.get(sql, [entryId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    res.json({
      message: 'Mood entry updated successfully',
      moodEntry: updatedEntry
    });

  } catch (error) {
    console.error('Update mood entry error:', error);
    res.status(500).json({ error: 'Failed to update mood entry' });
  }
});

// Delete mood entry
router.delete('/:entryId', authenticateToken, async (req, res) => {
  try {
    const { entryId } = req.params;

    // Check if entry exists and belongs to user
    const existingEntry = await new Promise((resolve, reject) => {
      const sql = 'SELECT id FROM mood_entries WHERE id = ? AND user_id = ?';
      db.get(sql, [entryId, req.user.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!existingEntry) {
      return res.status(404).json({ error: 'Mood entry not found' });
    }

    await new Promise((resolve, reject) => {
      const sql = 'DELETE FROM mood_entries WHERE id = ?';
      db.run(sql, [entryId], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });

    res.json({ message: 'Mood entry deleted successfully' });

  } catch (error) {
    console.error('Delete mood entry error:', error);
    res.status(500).json({ error: 'Failed to delete mood entry' });
  }
});

// Get mood statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { userId = req.user.id, period = '30' } = req.query;

    // Check if user can access this data
    if (parseInt(userId) !== req.user.id && req.user.role !== 'therapist') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Get mood distribution
    const moodDistribution = await new Promise((resolve, reject) => {
      const sql = `
        SELECT mood, COUNT(*) as count
        FROM mood_entries 
        WHERE user_id = ? AND date >= ?
        GROUP BY mood
        ORDER BY count DESC
      `;
      db.all(sql, [userId, startDateStr], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Get average intensity
    const avgIntensity = await new Promise((resolve, reject) => {
      const sql = `
        SELECT AVG(intensity) as avg_intensity
        FROM mood_entries 
        WHERE user_id = ? AND date >= ?
      `;
      db.get(sql, [userId, startDateStr], (err, row) => {
        if (err) reject(err);
        else resolve(row.avg_intensity);
      });
    });

    // Get mood trends (last 7 days)
    const moodTrends = await new Promise((resolve, reject) => {
      const sql = `
        SELECT date, mood, intensity
        FROM mood_entries 
        WHERE user_id = ? AND date >= date('now', '-7 days')
        ORDER BY date ASC
      `;
      db.all(sql, [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Get most common mood
    const mostCommonMood = moodDistribution.length > 0 ? moodDistribution[0] : null;

    res.json({
      period: days,
      moodDistribution,
      averageIntensity: avgIntensity ? Math.round(avgIntensity * 10) / 10 : 0,
      moodTrends,
      mostCommonMood: mostCommonMood ? mostCommonMood.mood : null,
      totalEntries: moodDistribution.reduce((sum, item) => sum + item.count, 0)
    });

  } catch (error) {
    console.error('Get mood stats error:', error);
    res.status(500).json({ error: 'Failed to get mood statistics' });
  }
});

// Get today's mood entry
router.get('/today', authenticateToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const todayEntry = await new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM mood_entries WHERE user_id = ? AND date = ?';
      db.get(sql, [req.user.id, today], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    res.json({ moodEntry: todayEntry });

  } catch (error) {
    console.error('Get today mood error:', error);
    res.status(500).json({ error: 'Failed to get today\'s mood entry' });
  }
});

module.exports = router;