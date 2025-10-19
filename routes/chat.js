const express = require('express');
const { body, validationResult } = require('express-validator');
const { ChatMessage, User, UserConnection } = require('../models');
const { Op } = require('sequelize');

const router = express.Router();

// Send a message
router.post('/send', [
  body('recipient_id').optional().isUUID().withMessage('Valid recipient ID required'),
  body('message').notEmpty().withMessage('Message content is required').isLength({ max: 2000 }).withMessage('Message too long'),
  body('message_type').optional().isIn(['text', 'image', 'file']),
  body('chat_room').optional().isString(),
  body('is_ai_chat').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const {
      recipient_id,
      message,
      message_type = 'text',
      chat_room,
      is_ai_chat = false,
      file_url,
      file_name,
      file_size
    } = req.body;

    // Validate recipient exists and user has permission to message them
    if (recipient_id && !is_ai_chat) {
      const recipient = await User.findByPk(recipient_id);
      if (!recipient) {
        return res.status(404).json({ message: 'Recipient not found' });
      }

      // Check if users are connected (optional - you might want to allow messaging without connection)
      const connection = await UserConnection.findOne({
        where: {
          [Op.or]: [
            { user_id: req.user.id, connected_user_id: recipient_id, status: 'accepted' },
            { user_id: recipient_id, connected_user_id: req.user.id, status: 'accepted' }
          ]
        }
      });

      // For now, allow messaging without connection, but you can uncomment this to require connections
      // if (!connection && !['therapist', 'admin'].includes(req.user.role)) {
      //   return res.status(403).json({ message: 'You can only message connected users' });
      // }
    }

    const chatMessage = await ChatMessage.create({
      sender_id: req.user.id,
      recipient_id: is_ai_chat ? null : recipient_id,
      message,
      message_type,
      chat_room,
      is_ai_chat,
      file_url,
      file_name,
      file_size
    });

    // Emit the message via Socket.IO
    const io = req.app.get('io');
    if (io) {
      if (recipient_id && !is_ai_chat) {
        io.to(`user_${recipient_id}`).emit('new_message', {
          id: chatMessage.id,
          sender_id: req.user.id,
          sender_name: `${req.user.first_name} ${req.user.last_name}`,
          message: chatMessage.message,
          message_type: chatMessage.message_type,
          created_at: chatMessage.created_at,
          file_url: chatMessage.file_url,
          file_name: chatMessage.file_name
        });
      } else if (chat_room) {
        io.to(chat_room).emit('new_message', {
          id: chatMessage.id,
          sender_id: req.user.id,
          sender_name: `${req.user.first_name} ${req.user.last_name}`,
          message: chatMessage.message,
          message_type: chatMessage.message_type,
          created_at: chatMessage.created_at,
          chat_room: chatMessage.chat_room
        });
      }
    }

    res.status(201).json({
      message: 'Message sent successfully',
      chatMessage
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Error sending message' });
  }
});

// Get conversation between two users
router.get('/conversation/:userId', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    const otherUserId = req.params.userId;

    // Verify the other user exists
    const otherUser = await User.findByPk(otherUserId);
    if (!otherUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const messages = await ChatMessage.findAndCountAll({
      where: {
        [Op.or]: [
          { sender_id: req.user.id, recipient_id: otherUserId },
          { sender_id: otherUserId, recipient_id: req.user.id }
        ],
        is_ai_chat: false
      },
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'first_name', 'last_name', 'profile_picture']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    // Mark messages as read
    await ChatMessage.update(
      { is_read: true, read_at: new Date() },
      {
        where: {
          sender_id: otherUserId,
          recipient_id: req.user.id,
          is_read: false
        }
      }
    );

    res.json({
      messages: messages.rows.reverse(), // Reverse to show oldest first
      pagination: {
        total: messages.count,
        page: parseInt(page),
        pages: Math.ceil(messages.count / limit),
        limit: parseInt(limit)
      },
      other_user: {
        id: otherUser.id,
        first_name: otherUser.first_name,
        last_name: otherUser.last_name,
        profile_picture: otherUser.profile_picture
      }
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ message: 'Error fetching conversation' });
  }
});

// Get AI chat history
router.get('/ai-chat', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const messages = await ChatMessage.findAndCountAll({
      where: {
        sender_id: req.user.id,
        is_ai_chat: true
      },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    res.json({
      messages: messages.rows.reverse(),
      pagination: {
        total: messages.count,
        page: parseInt(page),
        pages: Math.ceil(messages.count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get AI chat error:', error);
    res.status(500).json({ message: 'Error fetching AI chat history' });
  }
});

// Get chat room messages
router.get('/room/:roomName', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    const roomName = req.params.roomName;

    const messages = await ChatMessage.findAndCountAll({
      where: {
        chat_room: roomName
      },
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'first_name', 'last_name', 'profile_picture', 'role']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    res.json({
      messages: messages.rows.reverse(),
      pagination: {
        total: messages.count,
        page: parseInt(page),
        pages: Math.ceil(messages.count / limit),
        limit: parseInt(limit)
      },
      room_name: roomName
    });
  } catch (error) {
    console.error('Get room messages error:', error);
    res.status(500).json({ message: 'Error fetching room messages' });
  }
});

// Get user's recent conversations
router.get('/conversations', async (req, res) => {
  try {
    const conversations = await ChatMessage.findAll({
      where: {
        [Op.or]: [
          { sender_id: req.user.id },
          { recipient_id: req.user.id }
        ],
        is_ai_chat: false,
        recipient_id: { [Op.not]: null }
      },
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'first_name', 'last_name', 'profile_picture']
        },
        {
          model: User,
          as: 'recipient',
          attributes: ['id', 'first_name', 'last_name', 'profile_picture']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // Group by conversation partner and get the latest message for each
    const conversationMap = new Map();
    
    conversations.forEach(message => {
      const partnerId = message.sender_id === req.user.id ? message.recipient_id : message.sender_id;
      const partner = message.sender_id === req.user.id ? message.recipient : message.sender;
      
      if (!conversationMap.has(partnerId)) {
        conversationMap.set(partnerId, {
          partner,
          latest_message: message,
          unread_count: 0
        });
      }
      
      // Count unread messages from this partner
      if (message.recipient_id === req.user.id && !message.is_read) {
        conversationMap.get(partnerId).unread_count++;
      }
    });

    const recentConversations = Array.from(conversationMap.values())
      .sort((a, b) => new Date(b.latest_message.created_at) - new Date(a.latest_message.created_at));

    res.json({ conversations: recentConversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'Error fetching conversations' });
  }
});

// Mark messages as read
router.put('/mark-read/:conversationUserId', async (req, res) => {
  try {
    const conversationUserId = req.params.conversationUserId;

    await ChatMessage.update(
      { is_read: true, read_at: new Date() },
      {
        where: {
          sender_id: conversationUserId,
          recipient_id: req.user.id,
          is_read: false
        }
      }
    );

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ message: 'Error marking messages as read' });
  }
});

// Delete a message
router.delete('/:messageId', async (req, res) => {
  try {
    const message = await ChatMessage.findByPk(req.params.messageId);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Only sender or admin can delete
    if (message.sender_id !== req.user.id && !['admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'You can only delete your own messages' });
    }

    await message.destroy();

    // Emit deletion via Socket.IO
    const io = req.app.get('io');
    if (io && message.recipient_id) {
      io.to(`user_${message.recipient_id}`).emit('message_deleted', {
        message_id: message.id
      });
    }

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ message: 'Error deleting message' });
  }
});

// Flag a message
router.post('/:messageId/flag', [
  body('reason').notEmpty().withMessage('Flagging reason is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const { reason } = req.body;
    const message = await ChatMessage.findByPk(req.params.messageId);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    await message.update({
      is_flagged: true,
      flagged_reason: reason
    });

    res.json({ message: 'Message flagged successfully' });
  } catch (error) {
    console.error('Flag message error:', error);
    res.status(500).json({ message: 'Error flagging message' });
  }
});

// Get unread message count
router.get('/unread/count', async (req, res) => {
  try {
    const unreadCount = await ChatMessage.count({
      where: {
        recipient_id: req.user.id,
        is_read: false
      }
    });

    res.json({ unread_count: unreadCount });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: 'Error fetching unread count' });
  }
});

module.exports = router;