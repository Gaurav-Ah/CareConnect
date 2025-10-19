const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all activities
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      activity_type, 
      difficulty_level, 
      search,
      is_recurring 
    } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    let params = [];

    if (activity_type) {
      whereClause += ' AND activity_type = ?';
      params.push(activity_type);
    }

    if (difficulty_level) {
      whereClause += ' AND difficulty_level = ?';
      params.push(difficulty_level);
    }

    if (search) {
      whereClause += ' AND (title LIKE ? OR description LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (is_recurring !== undefined) {
      whereClause += ' AND is_recurring = ?';
      params.push(is_recurring === 'true' ? 1 : 0);
    }

    const activities = await new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          a.*,
          u.name as created_by_name,
          COUNT(ap.user_id) as participant_count
        FROM activities a
        LEFT JOIN users u ON a.created_by = u.id
        LEFT JOIN activity_participants ap ON a.id = ap.activity_id
        ${whereClause}
        GROUP BY a.id
        ORDER BY a.created_at DESC
        LIMIT ? OFFSET ?
      `;
      db.all(sql, [...params, limit, offset], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Get total count
    const totalCount = await new Promise((resolve, reject) => {
      const sql = `SELECT COUNT(*) as count FROM activities ${whereClause}`;
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    res.json({
      activities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({ error: 'Failed to get activities' });
  }
});

// Get specific activity
router.get('/:activityId', authenticateToken, async (req, res) => {
  try {
    const { activityId } = req.params;

    const activity = await new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          a.*,
          u.name as created_by_name,
          COUNT(ap.user_id) as participant_count
        FROM activities a
        LEFT JOIN users u ON a.created_by = u.id
        LEFT JOIN activity_participants ap ON a.id = ap.activity_id
        WHERE a.id = ?
        GROUP BY a.id
      `;
      db.get(sql, [activityId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    // Get participants
    const participants = await new Promise((resolve, reject) => {
      const sql = `
        SELECT u.id, u.name, u.profile_picture, ap.joined_at
        FROM activity_participants ap
        JOIN users u ON ap.user_id = u.id
        WHERE ap.activity_id = ?
        ORDER BY ap.joined_at ASC
      `;
      db.all(sql, [activityId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    activity.participants = participants;

    res.json({ activity });

  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({ error: 'Failed to get activity' });
  }
});

// Create new activity
router.post('/', authenticateToken, [
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title is required and must be less than 200 characters'),
  body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
  body('activity_type').isIn(['mental', 'physical', 'creative', 'social']).withMessage('Invalid activity type'),
  body('duration_minutes').optional().isInt({ min: 1, max: 480 }).withMessage('Duration must be between 1 and 480 minutes'),
  body('difficulty_level').optional().isIn(['beginner', 'intermediate', 'advanced']).withMessage('Invalid difficulty level'),
  body('is_recurring').optional().isBoolean().withMessage('is_recurring must be boolean'),
  body('recurring_pattern').optional().isIn(['daily', 'weekly', 'monthly']).withMessage('Invalid recurring pattern'),
  body('max_participants').optional().isInt({ min: 1, max: 1000 }).withMessage('Max participants must be between 1 and 1000')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title,
      description,
      activity_type,
      duration_minutes,
      difficulty_level = 'beginner',
      is_recurring = false,
      recurring_pattern,
      max_participants
    } = req.body;

    const activityId = await new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO activities (
          title, description, activity_type, duration_minutes, 
          difficulty_level, is_recurring, recurring_pattern, 
          max_participants, created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      db.run(sql, [
        title, description, activity_type, duration_minutes,
        difficulty_level, is_recurring, recurring_pattern,
        max_participants, req.user.id
      ], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });

    // Get the created activity
    const activity = await new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          a.*,
          u.name as created_by_name
        FROM activities a
        LEFT JOIN users u ON a.created_by = u.id
        WHERE a.id = ?
      `;
      db.get(sql, [activityId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    res.status(201).json({
      message: 'Activity created successfully',
      activity
    });

  } catch (error) {
    console.error('Create activity error:', error);
    res.status(500).json({ error: 'Failed to create activity' });
  }
});

// Join activity
router.post('/:activityId/join', authenticateToken, async (req, res) => {
  try {
    const { activityId } = req.params;

    // Check if activity exists
    const activity = await new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM activities WHERE id = ?';
      db.get(sql, [activityId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    // Check if user is already a participant
    const existingParticipant = await new Promise((resolve, reject) => {
      const sql = 'SELECT id FROM activity_participants WHERE activity_id = ? AND user_id = ?';
      db.get(sql, [activityId, req.user.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (existingParticipant) {
      return res.status(400).json({ error: 'Already joined this activity' });
    }

    // Check max participants limit
    if (activity.max_participants) {
      const participantCount = await new Promise((resolve, reject) => {
        const sql = 'SELECT COUNT(*) as count FROM activity_participants WHERE activity_id = ?';
        db.get(sql, [activityId], (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      });

      if (participantCount >= activity.max_participants) {
        return res.status(400).json({ error: 'Activity is full' });
      }
    }

    // Add participant
    await new Promise((resolve, reject) => {
      const sql = 'INSERT INTO activity_participants (activity_id, user_id) VALUES (?, ?)';
      db.run(sql, [activityId, req.user.id], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });

    res.json({ message: 'Successfully joined activity' });

  } catch (error) {
    console.error('Join activity error:', error);
    res.status(500).json({ error: 'Failed to join activity' });
  }
});

// Leave activity
router.delete('/:activityId/leave', authenticateToken, async (req, res) => {
  try {
    const { activityId } = req.params;

    // Check if user is a participant
    const participant = await new Promise((resolve, reject) => {
      const sql = 'SELECT id FROM activity_participants WHERE activity_id = ? AND user_id = ?';
      db.get(sql, [activityId, req.user.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!participant) {
      return res.status(400).json({ error: 'Not a participant of this activity' });
    }

    // Remove participant
    await new Promise((resolve, reject) => {
      const sql = 'DELETE FROM activity_participants WHERE activity_id = ? AND user_id = ?';
      db.run(sql, [activityId, req.user.id], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });

    res.json({ message: 'Successfully left activity' });

  } catch (error) {
    console.error('Leave activity error:', error);
    res.status(500).json({ error: 'Failed to leave activity' });
  }
});

// Get user's activities
router.get('/user/my-activities', authenticateToken, async (req, res) => {
  try {
    const { status = 'all' } = req.query;

    let whereClause = 'WHERE ap.user_id = ?';
    let params = [req.user.id];

    if (status === 'joined') {
      // Only activities user has joined
      whereClause += ' AND ap.user_id = ?';
    } else if (status === 'created') {
      // Only activities user created
      whereClause = 'WHERE a.created_by = ?';
      params = [req.user.id];
    }

    const activities = await new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          a.*,
          u.name as created_by_name,
          COUNT(ap2.user_id) as participant_count,
          ap.joined_at
        FROM activities a
        LEFT JOIN users u ON a.created_by = u.id
        LEFT JOIN activity_participants ap ON a.id = ap.activity_id
        LEFT JOIN activity_participants ap2 ON a.id = ap2.activity_id
        ${whereClause}
        GROUP BY a.id
        ORDER BY a.created_at DESC
      `;
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json({ activities });

  } catch (error) {
    console.error('Get user activities error:', error);
    res.status(500).json({ error: 'Failed to get user activities' });
  }
});

// Update activity (only by creator)
router.put('/:activityId', authenticateToken, [
  body('title').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Title must be less than 200 characters'),
  body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
  body('activity_type').optional().isIn(['mental', 'physical', 'creative', 'social']).withMessage('Invalid activity type'),
  body('duration_minutes').optional().isInt({ min: 1, max: 480 }).withMessage('Duration must be between 1 and 480 minutes'),
  body('difficulty_level').optional().isIn(['beginner', 'intermediate', 'advanced']).withMessage('Invalid difficulty level'),
  body('is_recurring').optional().isBoolean().withMessage('is_recurring must be boolean'),
  body('recurring_pattern').optional().isIn(['daily', 'weekly', 'monthly']).withMessage('Invalid recurring pattern'),
  body('max_participants').optional().isInt({ min: 1, max: 1000 }).withMessage('Max participants must be between 1 and 1000')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { activityId } = req.params;

    // Check if activity exists and user is the creator
    const activity = await new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM activities WHERE id = ? AND created_by = ?';
      db.get(sql, [activityId, req.user.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found or access denied' });
    }

    const {
      title,
      description,
      activity_type,
      duration_minutes,
      difficulty_level,
      is_recurring,
      recurring_pattern,
      max_participants
    } = req.body;

    // Build update query
    const updates = [];
    const values = [];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (activity_type !== undefined) {
      updates.push('activity_type = ?');
      values.push(activity_type);
    }
    if (duration_minutes !== undefined) {
      updates.push('duration_minutes = ?');
      values.push(duration_minutes);
    }
    if (difficulty_level !== undefined) {
      updates.push('difficulty_level = ?');
      values.push(difficulty_level);
    }
    if (is_recurring !== undefined) {
      updates.push('is_recurring = ?');
      values.push(is_recurring);
    }
    if (recurring_pattern !== undefined) {
      updates.push('recurring_pattern = ?');
      values.push(recurring_pattern);
    }
    if (max_participants !== undefined) {
      updates.push('max_participants = ?');
      values.push(max_participants);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(activityId);

    const sql = `UPDATE activities SET ${updates.join(', ')} WHERE id = ?`;
    
    await new Promise((resolve, reject) => {
      db.run(sql, values, function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });

    // Get updated activity
    const updatedActivity = await new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          a.*,
          u.name as created_by_name,
          COUNT(ap.user_id) as participant_count
        FROM activities a
        LEFT JOIN users u ON a.created_by = u.id
        LEFT JOIN activity_participants ap ON a.id = ap.activity_id
        WHERE a.id = ?
        GROUP BY a.id
      `;
      db.get(sql, [activityId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    res.json({
      message: 'Activity updated successfully',
      activity: updatedActivity
    });

  } catch (error) {
    console.error('Update activity error:', error);
    res.status(500).json({ error: 'Failed to update activity' });
  }
});

// Delete activity (only by creator)
router.delete('/:activityId', authenticateToken, async (req, res) => {
  try {
    const { activityId } = req.params;

    // Check if activity exists and user is the creator
    const activity = await new Promise((resolve, reject) => {
      const sql = 'SELECT id FROM activities WHERE id = ? AND created_by = ?';
      db.get(sql, [activityId, req.user.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found or access denied' });
    }

    // Delete activity (participants will be deleted due to foreign key cascade)
    await new Promise((resolve, reject) => {
      const sql = 'DELETE FROM activities WHERE id = ?';
      db.run(sql, [activityId], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });

    res.json({ message: 'Activity deleted successfully' });

  } catch (error) {
    console.error('Delete activity error:', error);
    res.status(500).json({ error: 'Failed to delete activity' });
  }
});

module.exports = router;