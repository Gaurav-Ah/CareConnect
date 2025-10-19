const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ActivityParticipant = sequelize.define('ActivityParticipant', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  activity_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'activities',
      key: 'id'
    }
  },
  registration_status: {
    type: DataTypes.ENUM('registered', 'waitlisted', 'attended', 'no_show', 'cancelled'),
    defaultValue: 'registered'
  },
  registration_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  attendance_confirmed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  feedback_rating: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1,
      max: 5
    }
  },
  feedback_comment: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  special_needs: {
    type: DataTypes.TEXT,
    allowNull: true
  }
});

module.exports = ActivityParticipant;