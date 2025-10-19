const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const JournalEntry = sequelize.define('JournalEntry', {
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
  title: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: [0, 200]
    }
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  mood_before: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1,
      max: 10
    }
  },
  mood_after: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1,
      max: 10
    }
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: true,
    defaultValue: []
  },
  is_private: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  prompt_used: {
    type: DataTypes.STRING,
    allowNull: true
  },
  word_count: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  sentiment_score: {
    type: DataTypes.DECIMAL(3, 2),
    allowNull: true,
    validate: {
      min: -1,
      max: 1
    }
  }
});

// Hook to calculate word count before saving
JournalEntry.addHook('beforeSave', (entry) => {
  if (entry.content) {
    entry.word_count = entry.content.trim().split(/\s+/).length;
  }
});

module.exports = JournalEntry;