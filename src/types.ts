export type UserRole = 'patient' | 'volunteer' | 'therapist';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
}

export interface Activity {
  id: string;
  title: string;
  description: string;
  type: 'mental' | 'creative' | 'physical' | 'social';
  date: string;
  time: string;
  duration: string;
  participants: number;
  emoji: string;
  color: string;
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  content: string;
  date: string; // ISO
}

export interface MoodEntry {
  id: string;
  userId: string;
  mood: 'happy' | 'sad' | 'anxious' | 'angry' | 'tired' | 'neutral';
  intensity: number; // 1-10
  date: string; // ISO
}

export interface TherapySession {
  id: string;
  userId: string; // patient id
  therapist: string;
  date: string; // ISO
}

export interface ChatMessage {
  id: string;
  room: string;
  user: string; // display name
  content: string;
  time: string; // HH:mm
}

export interface DbSchema {
  users: User[];
  activities: Activity[];
  journals: JournalEntry[];
  moods: MoodEntry[];
  therapySessions: TherapySession[];
  chatMessages: ChatMessage[];
}
