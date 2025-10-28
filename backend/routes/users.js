const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all users (with filtering)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      role, 
      search,
      is_verified 
    } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    let params = [];

    if (role) {
      whereClause += ' AND role = ?';
      params.push(role);
    }

    if (search) {
      whereClause += ' AND (name LIKE ? OR email LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (is_verified !== undefined) {
      whereClause += ' AND is_verified = ?';
      params.push(is_verified === 'true' ? 1 : 0);
    }

    const users = await new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          id, name, email, age, role, profile_picture, bio, 
          is_verified, created_at
        FROM users 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;
      db.all(sql, [...params, limit, offset], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Get total count
    const totalCount = await new Promise((resolve, reject) => {
      const sql = `SELECT COUNT(*) as count FROM users ${whereClause}`;
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Get specific user profile
router.get('/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          id, name, email, age, role, profile_picture, bio, 
          is_verified, created_at
        FROM users 
        WHERE id = ?
      `;
      db.get(sql, [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Hide email for non-therapists unless it's the user's own profile
    if (req.user.role !== 'therapist' && req.user.id !== parseInt(userId)) {
      delete user.email;
    }

    res.json({ user });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Update user profile (admin only or own profile)
router.put('/:userId', authenticateToken, [
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('age').optional().isInt({ min: 13, max: 120 }).withMessage('Age must be between 13 and 120'),
  body('bio').optional().trim().isLength({ max: 500 }).withMessage('Bio must be less than 500 characters'),
  body('is_verified').optional().isBoolean().withMessage('is_verified must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { name, age, bio, is_verified } = req.body;

    // Check if user exists
    const existingUser = await new Promise((resolve, reject) => {
      const sql = 'SELECT id, role FROM users WHERE id = ?';
      db.get(sql, [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check permissions
    const canUpdate = 
      req.user.id === parseInt(userId) || 
      req.user.role === 'therapist' ||
      (req.user.role === 'therapist' && is_verified !== undefined);

    if (!canUpdate) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Build update query
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (age !== undefined) {
      updates.push('age = ?');
      values.push(age);
    }
    if (bio !== undefined) {
      updates.push('bio = ?');
      values.push(bio);
    }
    if (is_verified !== undefined && req.user.role === 'therapist') {
      updates.push('is_verified = ?');
      values.push(is_verified);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    
    await new Promise((resolve, reject) => {
      db.run(sql, values, function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });

    // Get updated user
    const updatedUser = await new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          id, name, email, age, role, profile_picture, bio, 
          is_verified, created_at
        FROM users 
        WHERE id = ?
      `;
      db.get(sql, [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    res.json({
      message: 'User updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Get user connections/friends
router.get('/:userId/connections', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user can access this data
    if (parseInt(userId) !== req.user.id && req.user.role !== 'therapist') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const connections = await new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          uc.*,
          u.name as connected_user_name,
          u.profile_picture as connected_user_picture,
          u.bio as connected_user_bio
        FROM user_connections uc
        JOIN users u ON uc.connected_user_id = u.id
        WHERE uc.user_id = ? AND uc.status = 'accepted'
        ORDER BY uc.created_at DESC
      `;
      db.all(sql, [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json({ connections });

  } catch (error) {
    console.error('Get connections error:', error);
    res.status(500).json({ error: 'Failed to get connections' });
  }
});

// Send connection request
router.post('/:userId/connect', authenticateToken, [
  body('connection_type').optional().isIn(['friend', 'mentor', 'peer']).withMessage('Invalid connection type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { connection_type = 'friend' } = req.body;

    // Can't connect to yourself
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: 'Cannot connect to yourself' });
    }

    // Check if target user exists
    const targetUser = await new Promise((resolve, reject) => {
      const sql = 'SELECT id, name FROM users WHERE id = ?';
      db.get(sql, [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if connection already exists
    const existingConnection = await new Promise((resolve, reject) => {
      const sql = `
        SELECT id, status FROM user_connections 
        WHERE (user_id = ? AND connected_user_id = ?) 
        OR (user_id = ? AND connected_user_id = ?)
      `;
      db.get(sql, [req.user.id, userId, userId, req.user.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (existingConnection) {
      return res.status(400).json({ error: 'Connection already exists' });
    }

    // Create connection request
    const connectionId = await new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO user_connections (user_id, connected_user_id, connection_type, status)
        VALUES (?, ?, ?, ?)
      `;
      db.run(sql, [req.user.id, userId, connection_type, 'pending'], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });

    res.status(201).json({
      message: 'Connection request sent successfully',
      connectionId
    });

  } catch (error) {
    console.error('Send connection error:', error);
    res.status(500).json({ error: 'Failed to send connection request' });
  }
});

// Accept/decline connection request
router.put('/connections/:connectionId', authenticateToken, [
  body('status').isIn(['accepted', 'blocked']).withMessage('Status must be accepted or blocked')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { connectionId } = req.params;
    const { status } = req.body;

    // Check if connection exists and user is the target
    const connection = await new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM user_connections WHERE id = ? AND connected_user_id = ?';
      db.get(sql, [connectionId, req.user.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!connection) {
      return res.status(404).json({ error: 'Connection request not found' });
    }

    if (connection.status !== 'pending') {
      return res.status(400).json({ error: 'Connection request already processed' });
    }

    // Update connection status
    await new Promise((resolve, reject) => {
      const sql = 'UPDATE user_connections SET status = ? WHERE id = ?';
      db.run(sql, [status, connectionId], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });

    res.json({ message: `Connection request ${status} successfully` });

  } catch (error) {
    console.error('Update connection error:', error);
    res.status(500).json({ error: 'Failed to update connection request' });
  }
});

// Get user statistics
router.get('/:userId/stats', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user can access this data
    if (parseInt(userId) !== req.user.id && req.user.role !== 'therapist') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get mood entries count
    const moodEntriesCount = await new Promise((resolve, reject) => {
      const sql = 'SELECT COUNT(*) as count FROM mood_entries WHERE user_id = ?';
      db.get(sql, [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    // Get journal entries count
    const journalEntriesCount = await new Promise((resolve, reject) => {
      const sql = 'SELECT COUNT(*) as count FROM journal_entries WHERE user_id = ?';
      db.get(sql, [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    // Get activities count
    const activitiesCount = await new Promise((resolve, reject) => {
      const sql = `
        SELECT COUNT(*) as count 
        FROM activity_participants ap
        JOIN activities a ON ap.activity_id = a.id
        WHERE ap.user_id = ?
      `;
      db.get(sql, [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    // Get therapy sessions count
    const therapySessionsCount = await new Promise((resolve, reject) => {
      const sql = 'SELECT COUNT(*) as count FROM therapy_sessions WHERE patient_id = ?';
      db.get(sql, [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    // Get connections count
    const connectionsCount = await new Promise((resolve, reject) => {
      const sql = 'SELECT COUNT(*) as count FROM user_connections WHERE user_id = ? AND status = "accepted"';
      db.get(sql, [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    res.json({
      moodEntries: moodEntriesCount,
      journalEntries: journalEntriesCount,
      activities: activitiesCount,
      therapySessions: therapySessionsCount,
      connections: connectionsCount
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ error: 'Failed to get user statistics' });
  }
});

module.exports = router;