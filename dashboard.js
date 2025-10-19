document.addEventListener('DOMContentLoaded', function() {
    // Mobile Navigation Toggle
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', function() {
            navLinks.classList.toggle('active');
        });
    }

    // Load user data
    const currentUser = JSON.parse(localStorage.getItem('currentUser')) || {};
    if (currentUser.name) {
        document.getElementById('user-name').textContent = currentUser.name;
    }
    
    // Load mood data
    const moodData = JSON.parse(localStorage.getItem('moodData')) || [];
    if (moodData.length > 0) {
        const latestMood = moodData[moodData.length - 1];
        updateMoodDisplay(latestMood);
    }
    
    // Load upcoming activities
    loadUpcomingActivities();
    
    // Load therapy sessions
    loadTherapySessions();
    
    // Encouragement messages
    const encouragementMessages = [
        "You're stronger than you think. Keep going!",
        "Healing is not linear. Be patient with yourself.",
        "Small steps still move you forward.",
        "Your feelings are valid and important.",
        "Today is a new opportunity to care for yourself.",
        "You're not alone in this journey.",
        "Progress takes time. Celebrate small victories."
    ];
    
    document.getElementById('encouragement-text').textContent = 
        encouragementMessages[Math.floor(Math.random() * encouragementMessages.length)];
    
    document.getElementById('new-encouragement').addEventListener('click', function() {
        document.getElementById('encouragement-text').textContent = 
            encouragementMessages[Math.floor(Math.random() * encouragementMessages.length)];
    });
    
    // Quick journal functionality
    document.getElementById('save-journal').addEventListener('click', function() {
        const entryText = document.getElementById('quick-journal-entry').value.trim();
        if (entryText) {
            saveJournalEntry(entryText);
            alert('Journal entry saved!');
            document.getElementById('quick-journal-entry').value = '';
        } else {
            alert('Please write something before saving');
        }
    });
    
    function updateMoodDisplay(moodEntry) {
        const moodEmoji = {
            happy: '😊',
            sad: '😢',
            anxious: '😰',
            angry: '😠',
            tired: '😴',
            neutral: '😐'
        };
        
        const moodLabels = {
            happy: 'Happy',
            sad: 'Sad',
            anxious: 'Anxious',
            angry: 'Angry',
            tired: 'Tired',
            neutral: 'Neutral'
        };
        
        document.getElementById('current-mood').textContent = moodEmoji[moodEntry.mood];
        document.getElementById('mood-status').textContent = moodLabels[moodEntry.mood];
        document.getElementById('mood-intensity').textContent = `Intensity: ${moodEntry.intensity}/10`;
        
        const entryDate = new Date(moodEntry.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (entryDate.toISOString() === today.toISOString()) {
            document.getElementById('mood-date').textContent = 'Today';
        } else {
            document.getElementById('mood-date').textContent = entryDate.toLocaleDateString();
        }
    }
    
    function loadUpcomingActivities() {
        // Simulated activity data
        const activities = [
            { name: 'Guided Meditation', time: 'Today, 3:00 PM', type: 'mental' },
            { name: 'Art Therapy Session', time: 'Tomorrow, 11:00 AM', type: 'creative' },
            { name: 'Support Group Chat', time: 'Friday, 2:00 PM', type: 'social' },
            { name: 'Gentle Yoga Class', time: 'Saturday, 10:00 AM', type: 'physical' }
        ];
        
        const activityList = document.getElementById('upcoming-activities');
        activityList.innerHTML = '';
        
        activities.slice(0, 3).forEach(activity => {
            const activityItem = document.createElement('div');
            activityItem.className = 'activity-item';
            activityItem.innerHTML = `
                <span class="activity-name">${activity.name}</span>
                <span class="activity-time">${activity.time}</span>
            `;
            activityList.appendChild(activityItem);
        });
    }
    
    function loadTherapySessions() {
        // Simulated therapy session data
        const sessions = JSON.parse(localStorage.getItem('therapySessions')) || [];
        
        if (sessions.length > 0) {
            // Find next upcoming session
            const now = new Date();
            const upcoming = sessions
                .map(s => ({ ...s, date: new Date(s.date) }))
                .filter(s => s.date > now)
                .sort((a, b) => a.date - b.date);
            
            if (upcoming.length > 0) {
                const nextSession = upcoming[0];
                const options = { 
                    weekday: 'long', 
                    month: 'short', 
                    day: 'numeric', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                };
                document.getElementById('next-session').textContent = 
                    `Next session: ${nextSession.therapist} on ${nextSession.date.toLocaleDateString('en-US', options)}`;
            }
        }
    }
    
    function saveJournalEntry(text) {
        const today = new Date();
        const dateString = today.toISOString().split('T')[0];
        
        const journalEntries = JSON.parse(localStorage.getItem('journalEntries')) || [];
        
        const newEntry = {
            date: dateString,
            text: text,
            timestamp: today.getTime()
        };
        
        journalEntries.push(newEntry);
        localStorage.setItem('journalEntries', JSON.stringify(journalEntries));
    }
});