const bcrypt = require('bcryptjs');
const { db } = require('../config/database');

// Sample data
const sampleUsers = [
  {
    name: 'Dr. Sarah Johnson',
    email: 'sarah.johnson@careconnect.com',
    password: 'password123',
    age: 35,
    role: 'therapist',
    bio: 'Licensed therapist specializing in cognitive behavioral therapy and anxiety management.',
    is_verified: 1
  },
  {
    name: 'Mike Thompson',
    email: 'mike.thompson@email.com',
    password: 'password123',
    age: 28,
    role: 'patient',
    bio: 'Looking for support and community in my mental health journey.',
    is_verified: 1
  },
  {
    name: 'Lisa Chen',
    email: 'lisa.chen@email.com',
    password: 'password123',
    age: 42,
    role: 'volunteer',
    bio: 'Passionate about helping others through their healing process.',
    is_verified: 1
  },
  {
    name: 'Alex Rodriguez',
    email: 'alex.rodriguez@email.com',
    password: 'password123',
    age: 24,
    role: 'patient',
    bio: 'New to the platform, excited to connect with others.',
    is_verified: 1
  },
  {
    name: 'Dr. Michael Brown',
    email: 'michael.brown@careconnect.com',
    password: 'password123',
    age: 45,
    role: 'therapist',
    bio: 'Experienced therapist with 15+ years in trauma recovery and PTSD treatment.',
    is_verified: 1
  }
];

const sampleChatRooms = [
  {
    name: 'General Support',
    description: 'A welcoming space for general support and conversation',
    room_type: 'general',
    is_private: 0,
    created_by: 1
  },
  {
    name: 'Chronic Pain Support',
    description: 'Share experiences and coping strategies for chronic pain',
    room_type: 'support',
    is_private: 0,
    created_by: 1
  },
  {
    name: 'Mental Health Discussion',
    description: 'Discuss mental health challenges and strategies',
    room_type: 'support',
    is_private: 0,
    created_by: 1
  },
  {
    name: 'Caregivers Support',
    description: 'Support for those caring for loved ones with chronic illness',
    room_type: 'support',
    is_private: 0,
    created_by: 1
  },
  {
    name: 'Success Stories',
    description: 'Share your victories and progress',
    room_type: 'general',
    is_private: 0,
    created_by: 1
  }
];

const sampleActivities = [
  {
    title: 'Guided Meditation Session',
    description: 'A peaceful 30-minute guided meditation to help reduce stress and anxiety',
    activity_type: 'mental',
    duration_minutes: 30,
    difficulty_level: 'beginner',
    is_recurring: 1,
    recurring_pattern: 'daily',
    max_participants: 50,
    created_by: 1
  },
  {
    title: 'Art Therapy Workshop',
    description: 'Express yourself through creative art activities in a supportive environment',
    activity_type: 'creative',
    duration_minutes: 60,
    difficulty_level: 'beginner',
    is_recurring: 1,
    recurring_pattern: 'weekly',
    max_participants: 15,
    created_by: 1
  },
  {
    title: 'Gentle Yoga Class',
    description: 'Low-impact yoga designed for all fitness levels and physical abilities',
    activity_type: 'physical',
    duration_minutes: 45,
    difficulty_level: 'beginner',
    is_recurring: 1,
    recurring_pattern: 'weekly',
    max_participants: 20,
    created_by: 1
  },
  {
    title: 'Support Group Chat',
    description: 'Join our weekly support group discussion on various mental health topics',
    activity_type: 'social',
    duration_minutes: 60,
    difficulty_level: 'beginner',
    is_recurring: 1,
    recurring_pattern: 'weekly',
    max_participants: 25,
    created_by: 1
  },
  {
    title: 'Music Therapy Session',
    description: 'Explore the healing power of music through listening and discussion',
    activity_type: 'creative',
    duration_minutes: 45,
    difficulty_level: 'beginner',
    is_recurring: 0,
    max_participants: 12,
    created_by: 1
  }
];

const sampleMoodEntries = [
  {
    user_id: 2,
    mood: 'anxious',
    intensity: 7,
    notes: 'Feeling overwhelmed with work today',
    date: '2025-01-15'
  },
  {
    user_id: 2,
    mood: 'happy',
    intensity: 8,
    notes: 'Had a great therapy session today',
    date: '2025-01-14'
  },
  {
    user_id: 4,
    mood: 'neutral',
    intensity: 5,
    notes: 'Just getting started with mood tracking',
    date: '2025-01-15'
  },
  {
    user_id: 2,
    mood: 'sad',
    intensity: 6,
    notes: 'Missing family today',
    date: '2025-01-13'
  }
];

const sampleJournalEntries = [
  {
    user_id: 2,
    title: 'First Day on CareConnect',
    content: 'Today I joined CareConnect and I\'m feeling hopeful about this journey. I\'ve been struggling with anxiety for a while now, but I\'m ready to take steps towards healing.',
    mood: 'hopeful',
    tags: JSON.stringify(['first-day', 'anxiety', 'hope']),
    is_private: 1
  },
  {
    user_id: 2,
    title: 'Therapy Session Reflection',
    content: 'Had my first therapy session today. Dr. Johnson was very understanding and helped me identify some patterns in my thinking. I feel like I\'m already making progress.',
    mood: 'happy',
    tags: JSON.stringify(['therapy', 'progress', 'reflection']),
    is_private: 1
  },
  {
    user_id: 4,
    title: 'New to This',
    content: 'I\'m new to journaling and mental health tracking. It feels strange to write down my thoughts, but I think it might help me understand myself better.',
    mood: 'neutral',
    tags: JSON.stringify(['new', 'learning', 'self-discovery']),
    is_private: 1
  }
];

const sampleTherapySessions = [
  {
    patient_id: 2,
    therapist_id: 1,
    session_date: '2025-01-20 14:00:00',
    duration_minutes: 60,
    session_type: 'individual',
    status: 'scheduled',
    notes: 'Initial consultation and assessment'
  },
  {
    patient_id: 4,
    therapist_id: 5,
    session_date: '2025-01-22 10:00:00',
    duration_minutes: 60,
    session_type: 'individual',
    status: 'scheduled',
    notes: 'First therapy session'
  },
  {
    patient_id: 2,
    therapist_id: 1,
    session_date: '2025-01-13 14:00:00',
    duration_minutes: 60,
    session_type: 'individual',
    status: 'completed',
    notes: 'Discussed anxiety management techniques and coping strategies'
  }
];

const sampleMessages = [
  {
    room_id: 1,
    user_id: 1,
    content: 'Welcome to the General Support chat! Please be kind and respectful to others.',
    message_type: 'text'
  },
  {
    room_id: 1,
    user_id: 2,
    content: 'Hi everyone! I just joined CareConnect. Looking forward to getting to know you all.',
    message_type: 'text'
  },
  {
    room_id: 1,
    user_id: 3,
    content: 'Welcome Mike! We\'re glad you\'re here. How are you feeling today?',
    message_type: 'text'
  },
  {
    room_id: 2,
    user_id: 1,
    content: 'This is a safe space to discuss chronic pain challenges and solutions.',
    message_type: 'text'
  },
  {
    room_id: 2,
    user_id: 4,
    content: 'Has anyone tried the new mindfulness techniques from yesterday\'s workshop?',
    message_type: 'text'
  }
];

// Seed function
async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');

    // Hash passwords for users
    for (let user of sampleUsers) {
      user.password = await bcrypt.hash(user.password, 12);
    }

    // Insert users
    console.log('👥 Creating users...');
    for (let user of sampleUsers) {
      await new Promise((resolve, reject) => {
        const sql = `
          INSERT INTO users (name, email, password, age, role, bio, is_verified)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        db.run(sql, [user.name, user.email, user.password, user.age, user.role, user.bio, user.is_verified], function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        });
      });
    }

    // Insert chat rooms
    console.log('💬 Creating chat rooms...');
    for (let room of sampleChatRooms) {
      await new Promise((resolve, reject) => {
        const sql = `
          INSERT INTO chat_rooms (name, description, room_type, is_private, created_by)
          VALUES (?, ?, ?, ?, ?)
        `;
        db.run(sql, [room.name, room.description, room.room_type, room.is_private, room.created_by], function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        });
      });
    }

    // Insert activities
    console.log('🎯 Creating activities...');
    for (let activity of sampleActivities) {
      await new Promise((resolve, reject) => {
        const sql = `
          INSERT INTO activities (title, description, activity_type, duration_minutes, difficulty_level, is_recurring, recurring_pattern, max_participants, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        db.run(sql, [
          activity.title, activity.description, activity.activity_type, 
          activity.duration_minutes, activity.difficulty_level, 
          activity.is_recurring, activity.recurring_pattern, 
          activity.max_participants, activity.created_by
        ], function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        });
      });
    }

    // Insert mood entries
    console.log('😊 Creating mood entries...');
    for (let mood of sampleMoodEntries) {
      await new Promise((resolve, reject) => {
        const sql = `
          INSERT INTO mood_entries (user_id, mood, intensity, notes, date)
          VALUES (?, ?, ?, ?, ?)
        `;
        db.run(sql, [mood.user_id, mood.mood, mood.intensity, mood.notes, mood.date], function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        });
      });
    }

    // Insert journal entries
    console.log('📝 Creating journal entries...');
    for (let journal of sampleJournalEntries) {
      await new Promise((resolve, reject) => {
        const sql = `
          INSERT INTO journal_entries (user_id, title, content, mood, tags, is_private)
          VALUES (?, ?, ?, ?, ?, ?)
        `;
        db.run(sql, [journal.user_id, journal.title, journal.content, journal.mood, journal.tags, journal.is_private], function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        });
      });
    }

    // Insert therapy sessions
    console.log('🩺 Creating therapy sessions...');
    for (let session of sampleTherapySessions) {
      await new Promise((resolve, reject) => {
        const sql = `
          INSERT INTO therapy_sessions (patient_id, therapist_id, session_date, duration_minutes, session_type, status, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        db.run(sql, [
          session.patient_id, session.therapist_id, session.session_date, 
          session.duration_minutes, session.session_type, session.status, session.notes
        ], function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        });
      });
    }

    // Insert messages
    console.log('💬 Creating messages...');
    for (let message of sampleMessages) {
      await new Promise((resolve, reject) => {
        const sql = `
          INSERT INTO messages (room_id, user_id, content, message_type)
          VALUES (?, ?, ?, ?)
        `;
        db.run(sql, [message.room_id, message.user_id, message.content, message.message_type], function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        });
      });
    }

    // Add some activity participants
    console.log('👥 Adding activity participants...');
    const participantData = [
      { activity_id: 1, user_id: 2 },
      { activity_id: 1, user_id: 4 },
      { activity_id: 2, user_id: 2 },
      { activity_id: 3, user_id: 4 },
      { activity_id: 4, user_id: 2 },
      { activity_id: 4, user_id: 3 }
    ];

    for (let participant of participantData) {
      await new Promise((resolve, reject) => {
        const sql = 'INSERT INTO activity_participants (activity_id, user_id) VALUES (?, ?)';
        db.run(sql, [participant.activity_id, participant.user_id], function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        });
      });
    }

    console.log('✅ Database seeding completed successfully!');
    console.log('\n📊 Sample data created:');
    console.log(`- ${sampleUsers.length} users (2 therapists, 2 patients, 1 volunteer)`);
    console.log(`- ${sampleChatRooms.length} chat rooms`);
    console.log(`- ${sampleActivities.length} activities`);
    console.log(`- ${sampleMoodEntries.length} mood entries`);
    console.log(`- ${sampleJournalEntries.length} journal entries`);
    console.log(`- ${sampleTherapySessions.length} therapy sessions`);
    console.log(`- ${sampleMessages.length} messages`);
    console.log('\n🔑 Test credentials:');
    console.log('Therapist: sarah.johnson@careconnect.com / password123');
    console.log('Patient: mike.thompson@email.com / password123');
    console.log('Volunteer: lisa.chen@email.com / password123');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

// Run seeding if called directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('🎉 Seeding process completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedDatabase };