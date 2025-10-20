const sequelize = require('../config/database');
const User = require('./User');
const MoodEntry = require('./MoodEntry');
const JournalEntry = require('./JournalEntry');
const ChatMessage = require('./ChatMessage');
const Activity = require('./Activity');
const ActivityParticipant = require('./ActivityParticipant');
const Appointment = require('./Appointment');
const UserConnection = require('./UserConnection');

// Define associations
User.hasMany(MoodEntry, { foreignKey: 'user_id', as: 'moodEntries' });
MoodEntry.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(JournalEntry, { foreignKey: 'user_id', as: 'journalEntries' });
JournalEntry.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(ChatMessage, { foreignKey: 'sender_id', as: 'sentMessages' });
ChatMessage.belongsTo(User, { foreignKey: 'sender_id', as: 'sender' });

User.hasMany(ChatMessage, { foreignKey: 'recipient_id', as: 'receivedMessages' });
ChatMessage.belongsTo(User, { foreignKey: 'recipient_id', as: 'recipient' });

User.hasMany(Activity, { foreignKey: 'created_by', as: 'createdActivities' });
Activity.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

User.belongsToMany(Activity, { 
  through: ActivityParticipant, 
  foreignKey: 'user_id',
  otherKey: 'activity_id',
  as: 'participatingActivities'
});
Activity.belongsToMany(User, { 
  through: ActivityParticipant, 
  foreignKey: 'activity_id',
  otherKey: 'user_id',
  as: 'participants'
});

User.hasMany(Appointment, { foreignKey: 'patient_id', as: 'patientAppointments' });
User.hasMany(Appointment, { foreignKey: 'therapist_id', as: 'therapistAppointments' });
Appointment.belongsTo(User, { foreignKey: 'patient_id', as: 'patient' });
Appointment.belongsTo(User, { foreignKey: 'therapist_id', as: 'therapist' });

// User connections (friends/support network)
User.belongsToMany(User, {
  through: UserConnection,
  as: 'connections',
  foreignKey: 'user_id',
  otherKey: 'connected_user_id'
});

const db = {
  sequelize,
  User,
  MoodEntry,
  JournalEntry,
  ChatMessage,
  Activity,
  ActivityParticipant,
  Appointment,
  UserConnection
};

module.exports = db;