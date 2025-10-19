const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ChatMessage = sequelize.define('ChatMessage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  sender_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  recipient_id: {
    type: DataTypes.UUID,
    allowNull: true, // null for group messages or AI chat
    references: {
      model: 'users',
      key: 'id'
    }
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  message_type: {
    type: DataTypes.ENUM('text', 'image', 'file', 'system', 'ai_response'),
    defaultValue: 'text'
  },
  chat_room: {
    type: DataTypes.STRING,
    allowNull: true // for group chats or specific chat rooms
  },
  is_ai_chat: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  ai_context: {
    type: DataTypes.JSONB,
    allowNull: true // store AI conversation context
  },
  is_read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  read_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  file_url: {
    type: DataTypes.STRING,
    allowNull: true
  },
  file_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  file_size: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  is_flagged: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  flagged_reason: {
    type: DataTypes.STRING,
    allowNull: true
  }
});

module.exports = ChatMessage;