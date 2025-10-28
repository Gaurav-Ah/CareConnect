const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../config/database');
const { authenticateToken, requireOwnershipOrRole } = require('../middleware/auth');

const router = express.Router();

// Get journal entries for a user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { userId = req.user.id } = req.query;
    const { page = 1, limit = 20, search, mood, tags, startDate, endDate } = req.query;
    const offset = (page - 1) * limit;

    // Check if user can access this data
    if (parseInt(userId) !== req.user.id && req.user.role !== 'therapist') {
      return res.status(403).json({ error: 'Access denied' });
    }

    let whereClause = 'WHERE user_id = ?';
    let params = [userId];

    if (search) {
      whereClause += ' AND (title LIKE ? OR content LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (mood) {
      whereClause += ' AND mood = ?';
      params.push(mood);
    }

    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      whereClause += ' AND (';
      tagArray.forEach((tag, index) => {
        if (index > 0) whereClause += ' OR ';
        whereClause += 'tags LIKE ?';
        params.push(`%"${tag}"%`);
      });
      whereClause += ')';
    }

    if (startDate) {
      whereClause += ' AND DATE(created_at) >= ?';
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND DATE(created_at) <= ?';
      params.push(endDate);
    }

    const journalEntries = await new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM journal_entries 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;
      db.all(sql, [...params, limit, offset], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Parse tags JSON for each entry
    journalEntries.forEach(entry => {
      if (entry.tags) {
        try {
          entry.tags = JSON.parse(entry.tags);
        } catch (e) {
          entry.tags = [];
        }
      } else {
        entry.tags = [];
      }
    });

    // Get total count
    const totalCount = await new Promise((resolve, reject) => {
      const sql = `SELECT COUNT(*) as count FROM journal_entries ${whereClause}`;
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    res.json({
      journalEntries,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Get journal entries error:', error);
    res.status(500).json({ error: 'Failed to get journal entries' });
  }
});

// Get specific journal entry
router.get('/:entryId', authenticateToken, async (req, res) => {
  try {
    const { entryId } = req.params;

    const journalEntry = await new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM journal_entries WHERE id = ? AND user_id = ?';
      db.get(sql, [entryId, req.user.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!journalEntry) {
      return res.status(404).json({ error: 'Journal entry not found' });
    }

    // Parse tags JSON
    if (journalEntry.tags) {
      try {
        journalEntry.tags = JSON.parse(journalEntry.tags);
      } catch (e) {
        journalEntry.tags = [];
      }
    } else {
      journalEntry.tags = [];
    }

    res.json({ journalEntry });

  } catch (error) {
    console.error('Get journal entry error:', error);
    res.status(500).json({ error: 'Failed to get journal entry' });
  }
});

// Create new journal entry
router.post('/', authenticateToken, [
  body('content').trim().isLength({ min: 1 }).withMessage('Content is required'),
  body('title').optional().trim().isLength({ max: 200 }).withMessage('Title must be less than 200 characters'),
  body('mood').optional().isIn(['happy', 'sad', 'anxious', 'angry', 'tired', 'neutral']).withMessage('Invalid mood value'),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  body('is_private').optional().isBoolean().withMessage('is_private must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { content, title, mood, tags = [], is_private = true } = req.body;

    const entryId = await new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO journal_entries (user_id, title, content, mood, tags, is_private)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      db.run(sql, [req.user.id, title, content, mood, JSON.stringify(tags), is_private], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });

    // Get the created entry
    const journalEntry = await new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM journal_entries WHERE id = ?';
      db.get(sql, [entryId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    // Parse tags JSON
    if (journalEntry.tags) {
      try {
        journalEntry.tags = JSON.parse(journalEntry.tags);
      } catch (e) {
        journalEntry.tags = [];
      }
    } else {
      journalEntry.tags = [];
    }

    res.status(201).json({
      message: 'Journal entry created successfully',
      journalEntry
    });

  } catch (error) {
    console.error('Create journal entry error:', error);
    res.status(500).json({ error: 'Failed to create journal entry' });
  }
});

// Update journal entry
router.put('/:entryId', authenticateToken, [
  body('content').optional().trim().isLength({ min: 1 }).withMessage('Content cannot be empty'),
  body('title').optional().trim().isLength({ max: 200 }).withMessage('Title must be less than 200 characters'),
  body('mood').optional().isIn(['happy', 'sad', 'anxious', 'angry', 'tired', 'neutral']).withMessage('Invalid mood value'),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  body('is_private').optional().isBoolean().withMessage('is_private must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { entryId } = req.params;
    const { content, title, mood, tags, is_private } = req.body;

    // Check if entry exists and belongs to user
    const existingEntry = await new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM journal_entries WHERE id = ? AND user_id = ?';
      db.get(sql, [entryId, req.user.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!existingEntry) {
      return res.status(404).json({ error: 'Journal entry not found' });
    }

    // Build update query
    const updates = [];
    const values = [];

    if (content !== undefined) {
      updates.push('content = ?');
      values.push(content);
    }
    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }
    if (mood !== undefined) {
      updates.push('mood = ?');
      values.push(mood);
    }
    if (tags !== undefined) {
      updates.push('tags = ?');
      values.push(JSON.stringify(tags));
    }
    if (is_private !== undefined) {
      updates.push('is_private = ?');
      values.push(is_private);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(entryId);

    const sql = `UPDATE journal_entries SET ${updates.join(', ')} WHERE id = ?`;
    
    await new Promise((resolve, reject) => {
      db.run(sql, values, function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });

    // Get updated entry
    const updatedEntry = await new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM journal_entries WHERE id = ?';
      db.get(sql, [entryId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    // Parse tags JSON
    if (updatedEntry.tags) {
      try {
        updatedEntry.tags = JSON.parse(updatedEntry.tags);
      } catch (e) {
        updatedEntry.tags = [];
      }
    } else {
      updatedEntry.tags = [];
    }

    res.json({
      message: 'Journal entry updated successfully',
      journalEntry: updatedEntry
    });

  } catch (error) {
    console.error('Update journal entry error:', error);
    res.status(500).json({ error: 'Failed to update journal entry' });
  }
});

// Delete journal entry
router.delete('/:entryId', authenticateToken, async (req, res) => {
  try {
    const { entryId } = req.params;

    // Check if entry exists and belongs to user
    const existingEntry = await new Promise((resolve, reject) => {
      const sql = 'SELECT id FROM journal_entries WHERE id = ? AND user_id = ?';
      db.get(sql, [entryId, req.user.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!existingEntry) {
      return res.status(404).json({ error: 'Journal entry not found' });
    }

    await new Promise((resolve, reject) => {
      const sql = 'DELETE FROM journal_entries WHERE id = ?';
      db.run(sql, [entryId], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });

    res.json({ message: 'Journal entry deleted successfully' });

  } catch (error) {
    console.error('Delete journal entry error:', error);
    res.status(500).json({ error: 'Failed to delete journal entry' });
  }
});

// Get journal statistics
router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Get total entries
    const totalEntries = await new Promise((resolve, reject) => {
      const sql = `
        SELECT COUNT(*) as count
        FROM journal_entries 
        WHERE user_id = ? AND DATE(created_at) >= ?
      `;
      db.get(sql, [req.user.id, startDateStr], (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    // Get mood distribution
    const moodDistribution = await new Promise((resolve, reject) => {
      const sql = `
        SELECT mood, COUNT(*) as count
        FROM journal_entries 
        WHERE user_id = ? AND DATE(created_at) >= ? AND mood IS NOT NULL
        GROUP BY mood
        ORDER BY count DESC
      `;
      db.all(sql, [req.user.id, startDateStr], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Get most used tags
    const allTags = await new Promise((resolve, reject) => {
      const sql = `
        SELECT tags
        FROM journal_entries 
        WHERE user_id = ? AND DATE(created_at) >= ? AND tags IS NOT NULL AND tags != '[]'
      `;
      db.all(sql, [req.user.id, startDateStr], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Count tag usage
    const tagCounts = {};
    allTags.forEach(row => {
      try {
        const tags = JSON.parse(row.tags);
        tags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      } catch (e) {
        // Skip invalid JSON
      }
    });

    const mostUsedTags = Object.entries(tagCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    // Get writing streak (consecutive days with entries)
    const entriesByDate = await new Promise((resolve, reject) => {
      const sql = `
        SELECT DATE(created_at) as date
        FROM journal_entries 
        WHERE user_id = ? AND DATE(created_at) >= ?
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `;
      db.all(sql, [req.user.id, startDateStr], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    let currentStreak = 0;
    let lastDate = new Date();
    lastDate.setDate(lastDate.getDate() - 1);

    for (const entry of entriesByDate) {
      const entryDate = new Date(entry.date);
      const diffTime = lastDate - entryDate;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        currentStreak++;
        lastDate = entryDate;
      } else if (diffDays === 0) {
        // Same day, continue streak
        continue;
      } else {
        // Streak broken
        break;
      }
    }

    res.json({
      period: days,
      totalEntries,
      moodDistribution,
      mostUsedTags,
      currentStreak,
      averageEntriesPerDay: Math.round((totalEntries / days) * 10) / 10
    });

  } catch (error) {
    console.error('Get journal stats error:', error);
    res.status(500).json({ error: 'Failed to get journal statistics' });
  }
});

module.exports = router;