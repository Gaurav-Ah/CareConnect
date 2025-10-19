document.addEventListener('DOMContentLoaded', function() {
    // Mobile Navigation Toggle
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', function() {
            navLinks.classList.toggle('active');
        });
    }

    // Sample activity data
    const activities = [
        {
            id: 1,
            title: "Guided Meditation Session",
            description: "Join our 30-minute guided meditation to reduce stress and improve emotional wellbeing.",
            type: "mental",
            date: "Tomorrow",
            time: "3:00 PM",
            duration: "30 mins",
            participants: 12,
            emoji: "🧘",
            color: "var(--mental)"
        },
        {
            id: 2,
            title: "Watercolor Painting Workshop",
            description: "Express yourself through art in this beginner-friendly watercolor session. All materials provided.",
            type: "creative",
            date: "Fri, Nov 17",
            time: "11:00 AM",
            duration: "1 hour",
            participants: 8,
            emoji: "🎨",
            color: "var(--creative)"
        },
        {
            id: 3,
            title: "Gentle Yoga Class",
            description: "Low-impact yoga designed for all ability levels to improve flexibility and relaxation.",
            type: "physical",
            date: "Sat, Nov 18",
            time: "10:00 AM",
            duration: "45 mins",
            participants: 15,
            emoji: "🧘‍♀️",
            color: "var(--physical)"
        },
        {
            id: 4,
            title: "Support Group Discussion",
            description: "Share experiences and coping strategies in a safe, moderated environment.",
            type: "social",
            date: "Sun, Nov 19",
            time: "2:00 PM",
            duration: "1 hour",
            participants: 20,
            emoji: "💬",
            color: "var(--social)"
        },
        {
            id: 5,
            title: "Music Therapy Session",
            description: "Explore emotional expression through music listening and simple instruments.",
            type: "creative",
            date: "Mon, Nov 20",
            time: "4:00 PM",
            duration: "45 mins",
            participants: 10,
            emoji: "🎵",
            color: "var(--creative)"
        },
        {
            id: 6,
            title: "Mindfulness Walk",
            description: "Outdoor walk focusing on mindfulness and connecting with nature.",
            type: "mental",
            date: "Tue, Nov 21",
            time: "9:00 AM",
            duration: "30 mins",
            participants: 18,
            emoji: "🚶‍♂️",
            color: "var(--mental)"
        }
    ];

    const activitiesGrid = document.getElementById('activities-grid');
    const filterButtons = document.querySelectorAll('.filter-btn');

    // Display all activities initially
    displayActivities(activities);

    // Filter activities
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Update active button
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');

            const filter = this.dataset.filter;
            if (filter === 'all') {
                displayActivities(activities);
            } else {
                const filteredActivities = activities.filter(activity => activity.type === filter);
                displayActivities(filteredActivities);
            }
        });
    });

    function displayActivities(activitiesToDisplay) {
        activitiesGrid.innerHTML = '';

        if (activitiesToDisplay.length === 0) {
            activitiesGrid.innerHTML = '<p class="no-activities">No activities found for this filter.</p>';
            return;
        }

        activitiesToDisplay.forEach(activity => {
            const activityCard = document.createElement('div');
            activityCard.className = 'activity-card';
            activityCard.innerHTML = `
                <div class="activity-image" style="background-color: ${activity.color}">
                    ${activity.emoji}
                </div>
                <div class="activity-content">
                    <h3 class="activity-title">${activity.title}</h3>
                    <div class="activity-meta">
                        <span>${activity.date} • ${activity.time}</span>
                        <span class="activity-type" style="background-color: ${activity.color}">${getTypeName(activity.type)}</span>
                    </div>
                    <p class="activity-description">${activity.description}</p>
                    <div class="activity-actions">
                        <span class="activity-participants">👥 ${activity.participants} joined</span>
                        <button class="btn btn-primary join-btn" data-id="${activity.id}">Join Now</button>
                    </div>
                </div>
            `;
            activitiesGrid.appendChild(activityCard);
        });

        // Add event listeners to join buttons
        document.querySelectorAll('.join-btn').forEach(button => {
            button.addEventListener('click', function() {
                const activityId = parseInt(this.dataset.id);
                const activity = activities.find(a => a.id === activityId);
                joinActivity(activity);
            });
        });
    }

    function getTypeName(type) {
        const typeNames = {
            creative: 'Creative',
            physical: 'Physical',
            mental: 'Mental',
            social: 'Social'
        };
        return typeNames[type] || type;
    }

    function joinActivity(activity) {
        // In a real app, this would send a request to the server
        alert(`You've joined "${activity.title}" on ${activity.date} at ${activity.time}`);
        
        // Update participants count in UI
        const participantElements = document.querySelectorAll(`.join-btn[data-id="${activity.id}"] + .activity-participants`);
        participantElements.forEach(el => {
            const currentText = el.textContent;
            const currentCount = parseInt(currentText.match(/\d+/)[0]);
            el.textContent = `👥 ${currentCount + 1} joined`;
        });
    }
});