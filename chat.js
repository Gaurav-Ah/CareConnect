document.addEventListener('DOMContentLoaded', function() {
    // Mobile Navigation Toggle
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', function() {
            navLinks.classList.toggle('active');
        });
    }

    // Sample data
    const currentUser = JSON.parse(localStorage.getItem('currentUser')) || { name: 'Guest' };
    const rooms = {
        'general': {
            name: 'General Support',
            topic: 'A place for general support and conversation',
            messages: [
                { user: 'CareConnect Bot', content: 'Welcome to the General Support chat! Please be kind and respectful to others.', time: '10:00 AM' },
                { user: 'Sarah_J', content: 'Hi everyone! I just joined CareConnect. Looking forward to getting to know you all.', time: '10:15 AM' },
                { user: 'MikeT', content: 'Welcome Sarah! How are you doing today?', time: '10:17 AM' }
            ]
        },
        'chronic-pain': {
            name: 'Chronic Pain Support',
            topic: 'Share experiences and coping strategies for chronic pain',
            messages: [
                { user: 'CareConnect Bot', content: 'This is a safe space to discuss chronic pain challenges and solutions.', time: '9:30 AM' },
                { user: 'PainFree2023', content: 'Has anyone tried the new mindfulness techniques from yesterday\'s workshop?', time: '11:45 AM' }
            ]
        },
        'mental-health': {
            name: 'Mental Health',
            topic: 'Discuss mental health challenges and strategies',
            messages: [
                { user: 'CareConnect Bot', content: 'Remember: Your feelings are valid and important.', time: '8:00 AM' },
                { user: 'Alex', content: 'Having a tough day today. The anxiety is really high.', time: '1:30 PM' },
                { user: 'Jamie', content: 'Hang in there Alex. You\'re not alone in this.', time: '1:35 PM' }
            ]
        },
        'caregivers': {
            name: 'Caregivers',
            topic: 'Support for those caring for loved ones with chronic illness',
            messages: [
                { user: 'CareConnect Bot', content: 'Thank you for all you do as caregivers!', time: 'Yesterday' },
                { user: 'CaregiverDave', content: 'Any tips for caregiver burnout? I\'m really struggling this week.', time: '10:50 AM' }
            ]
        },
        'success-stories': {
            name: 'Success Stories',
            topic: 'Share your victories and progress',
            messages: [
                { user: 'CareConnect Bot', content: 'Celebrate every victory, no matter how small!', time: 'Monday' },
                { user: 'Maria', content: 'I walked for 15 minutes today without too much pain! Small win!', time: '2:15 PM' },
                { user: 'Tom', content: 'That\'s awesome Maria! Keep it up!', time: '2:20 PM' }
            ]
        }
    };

    const onlineUsers = [
        'Sarah_J', 'MikeT', 'PainFree2023', 'Alex', 'Jamie', 
        'CaregiverDave', 'Maria', 'Tom', 'Jenny', 'Raj', 'Lisa', currentUser.name
    ];

    // DOM Elements
    const chatRooms = document.querySelectorAll('.chat-rooms li');
    const chatMessages = document.getElementById('chat-messages');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const currentRoomTitle = document.getElementById('current-room');
    const roomTopic = document.getElementById('room-topic');
    const userList = document.getElementById('user-list');
    const onlineCount = document.getElementById('online-count');

    // Current room
    let currentRoom = 'general';

    // Initialize
    displayRoom(currentRoom);
    displayOnlineUsers();

    // Room switching
    chatRooms.forEach(room => {
        room.addEventListener('click', function() {
            chatRooms.forEach(r => r.classList.remove('active'));
            this.classList.add('active');
            currentRoom = this.dataset.room;
            displayRoom(currentRoom);
        });
    });

    // Send message
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    function displayRoom(roomId) {
        const room = rooms[roomId];
        currentRoomTitle.textContent = room.name;
        roomTopic.textContent = room.topic;
        
        // Display messages
        chatMessages.innerHTML = '';
        room.messages.forEach(message => {
            addMessageToChat(message.user, message.content, message.time);
        });
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function addMessageToChat(user, content, time) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        
        const isCurrentUser = user === currentUser.name;
        
        messageDiv.innerHTML = `
            <div class="message-user ${isCurrentUser ? 'you' : ''}">
                ${user} 
                ${isCurrentUser ? '<span class="user-badge">You</span>' : ''}
            </div>
            <div class="message-content">${content}</div>
            <div class="message-time">${time}</div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function sendMessage() {
        const content = messageInput.value.trim();
        if (content === '') return;
        
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Add to our "database"
        rooms[currentRoom].messages.push({
            user: currentUser.name,
            content: content,
            time: timeString
        });
        
        // Display in chat
        addMessageToChat(currentUser.name, content, timeString);
        
        // Clear input
        messageInput.value = '';
    }

    function displayOnlineUsers() {
        onlineCount.textContent = onlineUsers.length;
        userList.innerHTML = '';
        
        onlineUsers.forEach(user => {
            const userItem = document.createElement('li');
            userItem.textContent = user;
            userList.appendChild(userItem);
        });
    }
});