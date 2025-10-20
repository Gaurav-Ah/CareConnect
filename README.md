# CareConnect Backend API

A comprehensive backend service for CareConnect - a mental health and wellness platform that connects patients, volunteers, and therapists through social activities, mood tracking, journaling, and therapy sessions.

## 🌟 Features

### Core Functionality
- **Multi-role Authentication**: Support for patients, volunteers, therapists, and admins
- **Mood Tracking**: Daily mood entries with analytics and trend analysis
- **Digital Journaling**: Private journaling with mood tracking and analytics
- **Real-time Chat**: Peer-to-peer messaging and AI-powered support chat
- **Social Activities**: Community activities like dance, music, art sessions
- **Appointment Scheduling**: Therapy session booking and management
- **User Connections**: Friend/support buddy system

### Technical Features
- **RESTful API**: Clean, well-documented REST endpoints
- **Real-time Communication**: Socket.IO for instant messaging and notifications
- **Role-based Access Control**: Secure, granular permissions system
- **Data Analytics**: Comprehensive mood and activity analytics
- **File Upload Support**: Profile pictures and activity materials
- **Database Migrations**: Automated database setup and updates

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

### Installation

1. **Clone and setup the project:**
   ```bash
   git clone <your-repo-url>
   cd careconnect-backend
   npm install
   ```

2. **Environment Configuration:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   # Database
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=careconnect
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   
   # JWT
   JWT_SECRET=your_super_secret_jwt_key_here
   JWT_EXPIRES_IN=7d
   
   # Server
   PORT=5000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:3000
   ```

3. **Database Setup:**
   ```bash
   # Create PostgreSQL database
   createdb careconnect
   
   # Run migrations (tables will be created automatically on first run)
   npm run dev
   ```

4. **Start the server:**
   ```bash
   # Development mode with auto-reload
   npm run dev
   
   # Production mode
   npm start
   ```

The server will start on `http://localhost:5000`

## 📚 API Documentation

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "first_name": "John",
  "last_name": "Doe",
  "role": "patient"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <jwt_token>
```

### Mood Tracking Endpoints

#### Create Mood Entry
```http
POST /api/mood
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "mood_score": 7,
  "mood_tags": ["happy", "energetic"],
  "notes": "Had a great day!",
  "sleep_hours": 8.5,
  "exercise_minutes": 30,
  "stress_level": 3
}
```

#### Get Mood Entries
```http
GET /api/mood?start_date=2024-01-01&end_date=2024-01-31
Authorization: Bearer <jwt_token>
```

#### Get Mood Analytics
```http
GET /api/mood/analytics/summary?start_date=2024-01-01&end_date=2024-01-31
Authorization: Bearer <jwt_token>
```

### Journal Endpoints

#### Create Journal Entry
```http
POST /api/journal
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "title": "Today's Reflection",
  "content": "Today I learned something important about myself...",
  "mood_before": 5,
  "mood_after": 7,
  "tags": ["reflection", "growth"],
  "is_private": true
}
```

#### Get Random Journal Prompt
```http
GET /api/journal/prompts/random
Authorization: Bearer <jwt_token>
```

### Chat Endpoints

#### Send Message
```http
POST /api/chat/send
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "recipient_id": "uuid-of-recipient",
  "message": "Hello, how are you?",
  "message_type": "text"
}
```

#### Get Conversation
```http
GET /api/chat/conversation/{userId}
Authorization: Bearer <jwt_token>
```

#### Get AI Chat History
```http
GET /api/chat/ai-chat
Authorization: Bearer <jwt_token>
```

### Activities Endpoints

#### Create Activity
```http
POST /api/activities
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "title": "Morning Dance Session",
  "description": "Join us for an energizing dance session",
  "activity_type": "dance",
  "scheduled_date": "2024-02-15T10:00:00Z",
  "duration_minutes": 60,
  "max_participants": 20,
  "is_virtual": true,
  "meeting_link": "https://zoom.us/j/123456789"
}
```

#### Get Activities
```http
GET /api/activities?activity_type=dance&page=1&limit=20
Authorization: Bearer <jwt_token>
```

#### Register for Activity
```http
POST /api/activities/{activityId}/register
Authorization: Bearer <jwt_token>
```

### Appointments Endpoints

#### Create Appointment
```http
POST /api/appointments
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "therapist_id": "uuid-of-therapist",
  "appointment_date": "2024-02-20T14:00:00Z",
  "duration_minutes": 60,
  "appointment_type": "follow_up",
  "session_format": "video_call",
  "patient_notes": "Looking forward to discussing my progress"
}
```

#### Get Therapist Availability
```http
GET /api/appointments/therapist/{therapistId}/availability?date=2024-02-20&duration=60
Authorization: Bearer <jwt_token>
```

## 🔧 Socket.IO Events

### Client to Server Events

- `join_room` - Join a chat room
- `leave_room` - Leave a chat room
- `send_message` - Send a real-time message
- `typing_start` - Indicate user is typing
- `typing_stop` - Indicate user stopped typing
- `message_read` - Mark message as read

### Server to Client Events

- `new_message` - Receive new message
- `message_sent` - Confirmation of sent message
- `user_typing` - Someone is typing
- `message_read_receipt` - Message read confirmation
- `user_joined` - User joined room
- `user_left` - User left room
- `user_status_update` - User online/offline status

## 🗄️ Database Schema

### Key Tables

- **users** - User accounts with role-based access
- **mood_entries** - Daily mood tracking data
- **journal_entries** - Private journal entries
- **chat_messages** - Real-time messaging
- **activities** - Social activities and events
- **activity_participants** - Activity registrations
- **appointments** - Therapy session scheduling
- **user_connections** - Friend/support relationships

## 🔐 Security Features

- **JWT Authentication** - Secure token-based auth
- **Role-based Access Control** - Granular permissions
- **Input Validation** - Comprehensive request validation
- **Rate Limiting** - API abuse prevention
- **CORS Protection** - Cross-origin request security
- **Helmet.js** - Security headers
- **Password Hashing** - bcrypt encryption

## 🚀 Deployment

### Environment Variables for Production
```env
NODE_ENV=production
PORT=5000
DB_HOST=your-production-db-host
DB_NAME=careconnect_prod
JWT_SECRET=your-production-jwt-secret
FRONTEND_URL=https://your-frontend-domain.com
```

### Docker Deployment
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

### Database Migration
```bash
# Production database setup
npm run migrate
npm run seed  # Optional: seed with sample data
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## 📊 Monitoring & Health Checks

- **Health Check**: `GET /health`
- **API Metrics**: Built-in request logging
- **Error Tracking**: Comprehensive error handling

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the API documentation for detailed endpoint information

---

**CareConnect Backend** - Empowering mental health through technology and community support.