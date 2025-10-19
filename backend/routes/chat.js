const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all chat rooms
router.get('/rooms', authenticateToken, async (req, res) => {
  try {
    const rooms = await new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          cr.*,
          u.name as created_by_name,
          COUNT(m.id) as message_count,
          MAX(m.created_at) as last_message_time
        FROM chat_rooms cr
        LEFT JOIN users u ON cr.created_by = u.id
        LEFT JOIN messages m ON cr.id = m.room_id
        WHERE cr.is_private = 0 OR cr.created_by = ?
        GROUP BY cr.id
        ORDER BY last_message_time DESC, cr.created_at DESC
      `;
      db.all(sql, [req.user.id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json({ rooms });
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ error: 'Failed to get chat rooms' });
  }
});

// Get specific chat room
router.get('/rooms/:roomId', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          cr.*,
          u.name as created_by_name
        FROM chat_rooms cr
        LEFT JOIN users u ON cr.created_by = u.id
        WHERE cr.id = ? AND (cr.is_private = 0 OR cr.created_by = ?)
      `;
      db.get(sql, [roomId, req.user.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!room) {
      return res.status(404).json({ error: 'Chat room not found' });
    }

    res.json({ room });
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ error: 'Failed to get chat room' });
  }
});

// Create new chat room
router.post('/rooms', authenticateToken, [
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Room name is required and must be less than 100 characters'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
  body('room_type').optional().isIn(['general', 'support', 'therapy']).withMessage('Invalid room type'),
  body('is_private').optional().isBoolean().withMessage('is_private must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, room_type = 'general', is_private = false } = req.body;

    const roomId = await new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO chat_rooms (name, description, room_type, is_private, created_by)
        VALUES (?, ?, ?, ?, ?)
      `;
      db.run(sql, [name, description, room_type, is_private, req.user.id], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });

    // Get the created room
    const room = await new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          cr.*,
          u.name as created_by_name
        FROM chat_rooms cr
        LEFT JOIN users u ON cr.created_by = u.id
        WHERE cr.id = ?
      `;
      db.get(sql, [roomId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    res.status(201).json({
      message: 'Chat room created successfully',
      room
    });

  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create chat room' });
  }
});

// Get messages for a room
router.get('/rooms/:roomId/messages', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    // First check if user has access to the room
    const room = await new Promise((resolve, reject) => {
      const sql = 'SELECT id, is_private, created_by FROM chat_rooms WHERE id = ?';
      db.get(sql, [roomId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!room) {
      return res.status(404).json({ error: 'Chat room not found' });
    }

    if (room.is_private && room.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied to private room' });
    }

    // Get messages
    const messages = await new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          m.*,
          u.name as user_name,
          u.profile_picture
        FROM messages m
        JOIN users u ON m.user_id = u.id
        WHERE m.room_id = ?
        ORDER BY m.created_at DESC
        LIMIT ? OFFSET ?
      `;
      db.all(sql, [roomId, limit, offset], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Get total count
    const totalCount = await new Promise((resolve, reject) => {
      const sql = 'SELECT COUNT(*) as count FROM messages WHERE room_id = ?';
      db.get(sql, [roomId], (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    res.json({
      messages: messages.reverse(), // Show oldest first
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// Send message to a room
router.post('/rooms/:roomId/messages', authenticateToken, [
  body('content').trim().isLength({ min: 1, max: 1000 }).withMessage('Message content is required and must be less than 1000 characters'),
  body('message_type').optional().isIn(['text', 'image', 'file']).withMessage('Invalid message type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { roomId } = req.params;
    const { content, message_type = 'text', file_path } = req.body;

    // Check if user has access to the room
    const room = await new Promise((resolve, reject) => {
      const sql = 'SELECT id, is_private, created_by FROM chat_rooms WHERE id = ?';
      db.get(sql, [roomId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!room) {
      return res.status(404).json({ error: 'Chat room not found' });
    }

    if (room.is_private && room.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied to private room' });
    }

    // Insert message
    const messageId = await new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO messages (room_id, user_id, content, message_type, file_path)
        VALUES (?, ?, ?, ?, ?)
      `;
      db.run(sql, [roomId, req.user.id, content, message_type, file_path], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });

    // Get the created message with user info
    const message = await new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          m.*,
          u.name as user_name,
          u.profile_picture
        FROM messages m
        JOIN users u ON m.user_id = u.id
        WHERE m.id = ?
      `;
      db.get(sql, [messageId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    res.status(201).json({
      message: 'Message sent successfully',
      data: message
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Delete message (only by author or admin)
router.delete('/messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;

    // Check if message exists and user has permission
    const message = await new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM messages WHERE id = ?';
      db.get(sql, [messageId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user is the author or has admin role
    if (message.user_id !== req.user.id && req.user.role !== 'therapist') {
      return res.status(403).json({ error: 'Permission denied' });
    }

    // Delete message
    await new Promise((resolve, reject) => {
      const sql = 'DELETE FROM messages WHERE id = ?';
      db.run(sql, [messageId], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });

    res.json({ message: 'Message deleted successfully' });

  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Get online users for a room (simplified - in real app, use Redis or similar)
router.get('/rooms/:roomId/online', authenticateToken, async (req, res) => {
  try {
    // This is a simplified implementation
    // In a real app, you'd track online users in Redis or similar
    const onlineUsers = await new Promise((resolve, reject) => {
      const sql = `
        SELECT DISTINCT u.id, u.name, u.profile_picture
        FROM users u
        WHERE u.id IN (
          SELECT DISTINCT user_id 
          FROM messages 
          WHERE room_id = ? 
          AND created_at > datetime('now', '-1 hour')
        )
        LIMIT 20
      `;
      db.all(sql, [req.params.roomId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json({ onlineUsers });

  } catch (error) {
    console.error('Get online users error:', error);
    res.status(500).json({ error: 'Failed to get online users' });
  }
});

module.exports = router;