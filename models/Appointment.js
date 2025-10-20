const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Appointment = sequelize.define('Appointment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  patient_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  therapist_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  appointment_date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  duration_minutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 60,
    validate: {
      min: 15,
      max: 180
    }
  },
  appointment_type: {
    type: DataTypes.ENUM('initial_consultation', 'follow_up', 'crisis_intervention', 'group_session', 'assessment'),
    defaultValue: 'follow_up'
  },
  session_format: {
    type: DataTypes.ENUM('in_person', 'video_call', 'phone_call'),
    defaultValue: 'video_call'
  },
  status: {
    type: DataTypes.ENUM('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'),
    defaultValue: 'scheduled'
  },
  meeting_link: {
    type: DataTypes.STRING,
    allowNull: true
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  patient_notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  therapist_notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  session_summary: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  homework_assigned: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  next_session_goals: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  is_recurring: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  recurrence_pattern: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  cancellation_reason: {
    type: DataTypes.STRING,
    allowNull: true
  },
  cancelled_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  reminder_sent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  follow_up_required: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
});

module.exports = Appointment;