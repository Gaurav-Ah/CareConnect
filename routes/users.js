const express = require('express');
const { body, validationResult } = require('express-validator');
const { User, UserConnection } = require('../models');
const { requireRole, requireOwnershipOrRole } = require('../middleware/auth');

const router = express.Router();

// Get all users (admin only) or filtered users for connections
router.get('/', async (req, res) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = { is_active: true };
    
    // Role filter
    if (role && ['patient', 'volunteer', 'therapist'].includes(role)) {
      whereClause.role = role;
    }

    // Search filter
    if (search) {
      const { Op } = require('sequelize');
      whereClause[Op.or] = [
        { first_name: { [Op.iLike]: `%${search}%` } },
        { last_name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const users = await User.findAndCountAll({
      where: whereClause,
      attributes: ['id', 'first_name', 'last_name', 'email', 'role', 'profile_picture', 'bio', 'created_at'],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    res.json({
      users: users.rows,
      pagination: {
        total: users.count,
        page: parseInt(page),
        pages: Math.ceil(users.count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// Get user by ID
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: ['id', 'first_name', 'last_name', 'email', 'role', 'profile_picture', 'bio', 'created_at']
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Error fetching user' });
  }
});

// Get user connections
router.get('/:id/connections', requireOwnershipOrRole('admin', 'therapist'), async (req, res) => {
  try {
    const connections = await UserConnection.findAll({
      where: { 
        user_id: req.params.id,
        status: 'accepted'
      },
      include: [{
        model: User,
        as: 'connected_user',
        attributes: ['id', 'first_name', 'last_name', 'role', 'profile_picture']
      }]
    });

    res.json({ connections });
  } catch (error) {
    console.error('Get connections error:', error);
    res.status(500).json({ message: 'Error fetching connections' });
  }
});

// Send connection request
router.post('/connect', [
  body('connected_user_id').isUUID().withMessage('Valid user ID required'),
  body('connection_type').isIn(['friend', 'support_buddy', 'mentor', 'mentee']).optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const { connected_user_id, connection_type = 'friend' } = req.body;

    // Check if target user exists
    const targetUser = await User.findByPk(connected_user_id);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if connection already exists
    const existingConnection = await UserConnection.findOne({
      where: {
        user_id: req.user.id,
        connected_user_id
      }
    });

    if (existingConnection) {
      return res.status(409).json({ message: 'Connection already exists' });
    }

    // Create connection request
    const connection = await UserConnection.create({
      user_id: req.user.id,
      connected_user_id,
      connection_type,
      initiated_by: req.user.id
    });

    res.status(201).json({
      message: 'Connection request sent',
      connection
    });
  } catch (error) {
    console.error('Send connection error:', error);
    res.status(500).json({ message: 'Error sending connection request' });
  }
});

// Accept/decline connection request
router.put('/connect/:connectionId', [
  body('status').isIn(['accepted', 'declined']).withMessage('Status must be accepted or declined')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const { status } = req.body;
    const connection = await UserConnection.findByPk(req.params.connectionId);

    if (!connection) {
      return res.status(404).json({ message: 'Connection request not found' });
    }

    // Only the recipient can accept/decline
    if (connection.connected_user_id !== req.user.id) {
      return res.status(403).json({ message: 'You can only respond to connection requests sent to you' });
    }

    await connection.update({
      status,
      accepted_at: status === 'accepted' ? new Date() : null
    });

    // If accepted, create reciprocal connection
    if (status === 'accepted') {
      await UserConnection.create({
        user_id: connection.connected_user_id,
        connected_user_id: connection.user_id,
        connection_type: connection.connection_type,
        status: 'accepted',
        initiated_by: connection.initiated_by,
        accepted_at: new Date()
      });
    }

    res.json({
      message: `Connection request ${status}`,
      connection
    });
  } catch (error) {
    console.error('Update connection error:', error);
    res.status(500).json({ message: 'Error updating connection request' });
  }
});

// Get pending connection requests
router.get('/connections/pending', async (req, res) => {
  try {
    const pendingRequests = await UserConnection.findAll({
      where: {
        connected_user_id: req.user.id,
        status: 'pending'
      },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'first_name', 'last_name', 'role', 'profile_picture']
      }]
    });

    res.json({ pendingRequests });
  } catch (error) {
    console.error('Get pending requests error:', error);
    res.status(500).json({ message: 'Error fetching pending requests' });
  }
});

module.exports = router;