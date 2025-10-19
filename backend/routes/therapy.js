const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get therapy sessions
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      session_type,
      startDate,
      endDate 
    } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    let params = [];

    // Filter based on user role
    if (req.user.role === 'patient') {
      whereClause += ' AND patient_id = ?';
      params.push(req.user.id);
    } else if (req.user.role === 'therapist') {
      whereClause += ' AND therapist_id = ?';
      params.push(req.user.id);
    } else if (req.user.role === 'volunteer') {
      // Volunteers can only see their own sessions if they're patients too
      whereClause += ' AND patient_id = ?';
      params.push(req.user.id);
    }

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    if (session_type) {
      whereClause += ' AND session_type = ?';
      params.push(session_type);
    }

    if (startDate) {
      whereClause += ' AND DATE(session_date) >= ?';
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND DATE(session_date) <= ?';
      params.push(endDate);
    }

    const sessions = await new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          ts.*,
          p.name as patient_name,
          p.email as patient_email,
          t.name as therapist_name,
          t.email as therapist_email
        FROM therapy_sessions ts
        JOIN users p ON ts.patient_id = p.id
        JOIN users t ON ts.therapist_id = t.id
        ${whereClause}
        ORDER BY ts.session_date DESC
        LIMIT ? OFFSET ?
      `;
      db.all(sql, [...params, limit, offset], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Get total count
    const totalCount = await new Promise((resolve, reject) => {
      const sql = `
        SELECT COUNT(*) as count
        FROM therapy_sessions ts
        JOIN users p ON ts.patient_id = p.id
        JOIN users t ON ts.therapist_id = t.id
        ${whereClause}
      `;
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    res.json({
      sessions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Get therapy sessions error:', error);
    res.status(500).json({ error: 'Failed to get therapy sessions' });
  }
});

// Get specific therapy session
router.get('/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          ts.*,
          p.name as patient_name,
          p.email as patient_email,
          t.name as therapist_name,
          t.email as therapist_email
        FROM therapy_sessions ts
        JOIN users p ON ts.patient_id = p.id
        JOIN users t ON ts.therapist_id = t.id
        WHERE ts.id = ?
      `;
      db.get(sql, [sessionId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!session) {
      return res.status(404).json({ error: 'Therapy session not found' });
    }

    // Check if user has access to this session
    if (req.user.role === 'patient' && session.patient_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (req.user.role === 'therapist' && session.therapist_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ session });

  } catch (error) {
    console.error('Get therapy session error:', error);
    res.status(500).json({ error: 'Failed to get therapy session' });
  }
});

// Create new therapy session (therapists only)
router.post('/', authenticateToken, requireRole(['therapist']), [
  body('patient_id').isInt().withMessage('Patient ID is required'),
  body('session_date').isISO8601().withMessage('Valid session date is required'),
  body('duration_minutes').optional().isInt({ min: 15, max: 180 }).withMessage('Duration must be between 15 and 180 minutes'),
  body('session_type').optional().isIn(['individual', 'group', 'family']).withMessage('Invalid session type'),
  body('notes').optional().trim().isLength({ max: 2000 }).withMessage('Notes must be less than 2000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { patient_id, session_date, duration_minutes = 60, session_type = 'individual', notes } = req.body;

    // Check if patient exists
    const patient = await new Promise((resolve, reject) => {
      const sql = 'SELECT id, name FROM users WHERE id = ? AND role = "patient"';
      db.get(sql, [patient_id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Check for conflicting sessions
    const conflictingSession = await new Promise((resolve, reject) => {
      const sql = `
        SELECT id FROM therapy_sessions 
        WHERE therapist_id = ? 
        AND session_date = ? 
        AND status != 'cancelled'
      `;
      db.get(sql, [req.user.id, session_date], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (conflictingSession) {
      return res.status(400).json({ error: 'You already have a session scheduled at this time' });
    }

    const sessionId = await new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO therapy_sessions (
          patient_id, therapist_id, session_date, duration_minutes, 
          session_type, notes, status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      db.run(sql, [patient_id, req.user.id, session_date, duration_minutes, session_type, notes, 'scheduled'], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });

    // Get the created session
    const session = await new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          ts.*,
          p.name as patient_name,
          p.email as patient_email,
          t.name as therapist_name,
          t.email as therapist_email
        FROM therapy_sessions ts
        JOIN users p ON ts.patient_id = p.id
        JOIN users t ON ts.therapist_id = t.id
        WHERE ts.id = ?
      `;
      db.get(sql, [sessionId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    res.status(201).json({
      message: 'Therapy session created successfully',
      session
    });

  } catch (error) {
    console.error('Create therapy session error:', error);
    res.status(500).json({ error: 'Failed to create therapy session' });
  }
});

// Update therapy session
router.put('/:sessionId', authenticateToken, [
  body('session_date').optional().isISO8601().withMessage('Valid session date is required'),
  body('duration_minutes').optional().isInt({ min: 15, max: 180 }).withMessage('Duration must be between 15 and 180 minutes'),
  body('session_type').optional().isIn(['individual', 'group', 'family']).withMessage('Invalid session type'),
  body('status').optional().isIn(['scheduled', 'completed', 'cancelled', 'rescheduled']).withMessage('Invalid status'),
  body('notes').optional().trim().isLength({ max: 2000 }).withMessage('Notes must be less than 2000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { sessionId } = req.params;
    const { session_date, duration_minutes, session_type, status, notes } = req.body;

    // Check if session exists and user has access
    const existingSession = await new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM therapy_sessions WHERE id = ?';
      db.get(sql, [sessionId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!existingSession) {
      return res.status(404).json({ error: 'Therapy session not found' });
    }

    // Check access permissions
    const canUpdate = 
      (req.user.role === 'therapist' && existingSession.therapist_id === req.user.id) ||
      (req.user.role === 'patient' && existingSession.patient_id === req.user.id);

    if (!canUpdate) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Build update query
    const updates = [];
    const values = [];

    if (session_date !== undefined) {
      updates.push('session_date = ?');
      values.push(session_date);
    }
    if (duration_minutes !== undefined) {
      updates.push('duration_minutes = ?');
      values.push(duration_minutes);
    }
    if (session_type !== undefined) {
      updates.push('session_type = ?');
      values.push(session_type);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(sessionId);

    const sql = `UPDATE therapy_sessions SET ${updates.join(', ')} WHERE id = ?`;
    
    await new Promise((resolve, reject) => {
      db.run(sql, values, function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });

    // Get updated session
    const updatedSession = await new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          ts.*,
          p.name as patient_name,
          p.email as patient_email,
          t.name as therapist_name,
          t.email as therapist_email
        FROM therapy_sessions ts
        JOIN users p ON ts.patient_id = p.id
        JOIN users t ON ts.therapist_id = t.id
        WHERE ts.id = ?
      `;
      db.get(sql, [sessionId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    res.json({
      message: 'Therapy session updated successfully',
      session: updatedSession
    });

  } catch (error) {
    console.error('Update therapy session error:', error);
    res.status(500).json({ error: 'Failed to update therapy session' });
  }
});

// Delete therapy session (therapists only)
router.delete('/:sessionId', authenticateToken, requireRole(['therapist']), async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Check if session exists and user is the therapist
    const session = await new Promise((resolve, reject) => {
      const sql = 'SELECT id FROM therapy_sessions WHERE id = ? AND therapist_id = ?';
      db.get(sql, [sessionId, req.user.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!session) {
      return res.status(404).json({ error: 'Therapy session not found or access denied' });
    }

    // Delete session
    await new Promise((resolve, reject) => {
      const sql = 'DELETE FROM therapy_sessions WHERE id = ?';
      db.run(sql, [sessionId], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });

    res.json({ message: 'Therapy session deleted successfully' });

  } catch (error) {
    console.error('Delete therapy session error:', error);
    res.status(500).json({ error: 'Failed to delete therapy session' });
  }
});

// Get available therapists
router.get('/therapists/available', authenticateToken, async (req, res) => {
  try {
    const therapists = await new Promise((resolve, reject) => {
      const sql = `
        SELECT id, name, email, bio, profile_picture
        FROM users 
        WHERE role = 'therapist' AND is_verified = 1
        ORDER BY name ASC
      `;
      db.all(sql, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json({ therapists });

  } catch (error) {
    console.error('Get therapists error:', error);
    res.status(500).json({ error: 'Failed to get therapists' });
  }
});

// Get upcoming sessions for user
router.get('/upcoming', authenticateToken, async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    let whereClause = 'WHERE ts.session_date > datetime("now")';
    let params = [];

    if (req.user.role === 'patient') {
      whereClause += ' AND ts.patient_id = ?';
      params.push(req.user.id);
    } else if (req.user.role === 'therapist') {
      whereClause += ' AND ts.therapist_id = ?';
      params.push(req.user.id);
    }

    const sessions = await new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          ts.*,
          p.name as patient_name,
          t.name as therapist_name
        FROM therapy_sessions ts
        JOIN users p ON ts.patient_id = p.id
        JOIN users t ON ts.therapist_id = t.id
        ${whereClause}
        ORDER BY ts.session_date ASC
        LIMIT ?
      `;
      db.all(sql, [...params, limit], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json({ sessions });

  } catch (error) {
    console.error('Get upcoming sessions error:', error);
    res.status(500).json({ error: 'Failed to get upcoming sessions' });
  }
});

module.exports = router;