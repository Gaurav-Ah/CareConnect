import { db } from './db.js';
import { nanoid } from 'nanoid';
export async function seedIfEmpty() {
    await db.read();
    if (db.data.activities.length === 0) {
        const activities = [
            {
                id: nanoid(),
                title: 'Guided Meditation Session',
                description: 'Join our 30-minute guided meditation to reduce stress and improve emotional wellbeing.',
                type: 'mental',
                date: 'Tomorrow',
                time: '3:00 PM',
                duration: '30 mins',
                participants: 12,
                emoji: '🧘',
                color: '#cdeafe',
            },
            {
                id: nanoid(),
                title: 'Watercolor Painting Workshop',
                description: 'Express yourself through art in this beginner-friendly watercolor session. All materials provided.',
                type: 'creative',
                date: 'Fri, Nov 17',
                time: '11:00 AM',
                duration: '1 hour',
                participants: 8,
                emoji: '🎨',
                color: '#fde2f3',
            },
            {
                id: nanoid(),
                title: 'Gentle Yoga Class',
                description: 'Low-impact yoga designed for all ability levels to improve flexibility and relaxation.',
                type: 'physical',
                date: 'Sat, Nov 18',
                time: '10:00 AM',
                duration: '45 mins',
                participants: 15,
                emoji: '🧘‍♀️',
                color: '#eaf7e9',
            },
            {
                id: nanoid(),
                title: 'Support Group Discussion',
                description: 'Share experiences and coping strategies in a safe, moderated environment.',
                type: 'social',
                date: 'Sun, Nov 19',
                time: '2:00 PM',
                duration: '1 hour',
                participants: 20,
                emoji: '💬',
                color: '#fff5cc',
            },
            {
                id: nanoid(),
                title: 'Music Therapy Session',
                description: 'Explore emotional expression through music listening and simple instruments.',
                type: 'creative',
                date: 'Mon, Nov 20',
                time: '4:00 PM',
                duration: '45 mins',
                participants: 10,
                emoji: '🎵',
                color: '#e6e6fa',
            },
            {
                id: nanoid(),
                title: 'Mindfulness Walk',
                description: 'Outdoor walk focusing on mindfulness and connecting with nature.',
                type: 'mental',
                date: 'Tue, Nov 21',
                time: '9:00 AM',
                duration: '30 mins',
                participants: 18,
                emoji: '🚶‍♂️',
                color: '#d1f7d6',
            },
        ];
        db.data.activities.push(...activities);
    }
    if (db.data.chatMessages.length === 0) {
        const now = new Date();
        const messages = [
            {
                id: nanoid(),
                room: 'general',
                user: 'CareConnect Bot',
                content: 'Welcome to the General Support chat! Please be kind and respectful to others.',
                time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
        ];
        db.data.chatMessages.push(...messages);
    }
    await db.write();
}
