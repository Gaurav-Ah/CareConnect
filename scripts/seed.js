const { User, Activity, MoodEntry, JournalEntry } = require('../models');
const bcrypt = require('bcryptjs');

async function seed() {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Create sample users
    const users = await User.bulkCreate([
      {
        email: 'admin@careconnect.com',
        password: await bcrypt.hash('admin123', 12),
        first_name: 'Admin',
        last_name: 'User',
        role: 'admin',
        is_verified: true
      },
      {
        email: 'therapist@careconnect.com',
        password: await bcrypt.hash('therapist123', 12),
        first_name: 'Dr. Sarah',
        last_name: 'Johnson',
        role: 'therapist',
        is_verified: true,
        bio: 'Licensed clinical psychologist specializing in anxiety and depression.'
      },
      {
        email: 'volunteer@careconnect.com',
        password: await bcrypt.hash('volunteer123', 12),
        first_name: 'Mike',
        last_name: 'Wilson',
        role: 'volunteer',
        is_verified: true,
        bio: 'Passionate about helping others through creative activities.'
      },
      {
        email: 'patient@careconnect.com',
        password: await bcrypt.hash('patient123', 12),
        first_name: 'Emily',
        last_name: 'Davis',
        role: 'patient',
        is_verified: true
      }
    ], { individualHooks: true });

    console.log('✅ Sample users created');

    // Create sample activities
    const volunteer = users.find(u => u.role === 'volunteer');
    const therapist = users.find(u => u.role === 'therapist');
    
    await Activity.bulkCreate([
      {
        title: 'Morning Dance Therapy',
        description: 'Start your day with energizing dance movements designed to boost mood and energy.',
        activity_type: 'dance',
        difficulty_level: 'all_levels',
        created_by: volunteer.id,
        scheduled_date: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        duration_minutes: 60,
        max_participants: 15,
        is_virtual: true,
        meeting_link: 'https://zoom.us/j/123456789',
        tags: ['morning', 'energy', 'movement']
      },
      {
        title: 'Art Therapy Workshop',
        description: 'Express yourself through creative art in a supportive group environment.',
        activity_type: 'art',
        difficulty_level: 'beginner',
        created_by: volunteer.id,
        scheduled_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Day after tomorrow
        duration_minutes: 90,
        max_participants: 12,
        is_virtual: false,
        location: 'Community Center Room A',
        materials_needed: ['Paper', 'Colored pencils', 'Watercolors'],
        tags: ['creativity', 'expression', 'art']
      },
      {
        title: 'Mindfulness Meditation',
        description: 'Guided meditation session to help reduce stress and increase mindfulness.',
        activity_type: 'meditation',
        difficulty_level: 'all_levels',
        created_by: therapist.id,
        scheduled_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        duration_minutes: 45,
        max_participants: 20,
        is_virtual: true,
        meeting_link: 'https://zoom.us/j/987654321',
        tags: ['mindfulness', 'stress-relief', 'meditation']
      }
    ]);

    console.log('✅ Sample activities created');

    // Create sample mood entries for the patient
    const patient = users.find(u => u.role === 'patient');
    const moodEntries = [];
    
    for (let i = 7; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      moodEntries.push({
        user_id: patient.id,
        mood_score: Math.floor(Math.random() * 6) + 4, // Random score between 4-9
        mood_tags: ['hopeful', 'calm', 'energetic'].slice(0, Math.floor(Math.random() * 3) + 1),
        notes: `Mood entry for ${date.toDateString()}`,
        sleep_hours: 6 + Math.random() * 3, // 6-9 hours
        exercise_minutes: Math.floor(Math.random() * 60), // 0-60 minutes
        stress_level: Math.floor(Math.random() * 5) + 1, // 1-5
        energy_level: Math.floor(Math.random() * 6) + 4, // 4-9
        entry_date: date.toISOString().split('T')[0]
      });
    }
    
    await MoodEntry.bulkCreate(moodEntries);
    console.log('✅ Sample mood entries created');

    // Create sample journal entries
    await JournalEntry.bulkCreate([
      {
        user_id: patient.id,
        title: 'A New Beginning',
        content: 'Today marks the start of my journey with CareConnect. I\'m feeling hopeful about the support I\'ll receive and the connections I\'ll make. The community seems welcoming and understanding.',
        mood_before: 5,
        mood_after: 7,
        tags: ['hope', 'new-beginnings', 'community'],
        is_private: true
      },
      {
        user_id: patient.id,
        title: 'Gratitude Practice',
        content: 'I\'m grateful for the small moments today - the warm cup of tea in the morning, a kind message from a friend, and the beautiful sunset. These little things make such a difference in how I feel.',
        mood_before: 6,
        mood_after: 8,
        tags: ['gratitude', 'mindfulness', 'positivity'],
        is_private: true
      }
    ]);

    console.log('✅ Sample journal entries created');
    console.log('🎉 Database seeding completed successfully!');
    
    console.log('\n📋 Sample Login Credentials:');
    console.log('Admin: admin@careconnect.com / admin123');
    console.log('Therapist: therapist@careconnect.com / therapist123');
    console.log('Volunteer: volunteer@careconnect.com / volunteer123');
    console.log('Patient: patient@careconnect.com / patient123');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();