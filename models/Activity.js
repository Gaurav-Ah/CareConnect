const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Activity = sequelize.define('Activity', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [1, 200]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  activity_type: {
    type: DataTypes.ENUM('dance', 'music', 'art', 'meditation', 'group_therapy', 'workshop', 'social', 'exercise'),
    allowNull: false
  },
  difficulty_level: {
    type: DataTypes.ENUM('beginner', 'intermediate', 'advanced', 'all_levels'),
    defaultValue: 'all_levels'
  },
  max_participants: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1
    }
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  scheduled_date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  duration_minutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 15,
      max: 480 // 8 hours max
    }
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true
  },
  is_virtual: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  meeting_link: {
    type: DataTypes.STRING,
    allowNull: true
  },
  materials_needed: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: true,
    defaultValue: []
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: true,
    defaultValue: []
  },
  is_recurring: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  recurrence_pattern: {
    type: DataTypes.JSONB,
    allowNull: true // {frequency: 'weekly', interval: 1, days: ['monday', 'wednesday']}
  },
  status: {
    type: DataTypes.ENUM('scheduled', 'in_progress', 'completed', 'cancelled'),
    defaultValue: 'scheduled'
  },
  is_public: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  age_restriction: {
    type: DataTypes.STRING,
    allowNull: true // e.g., "18+", "13-17", "all_ages"
  },
  special_requirements: {
    type: DataTypes.TEXT,
    allowNull: true
  }
});

module.exports = Activity;