# CareConnect Backend API

A comprehensive backend API for the CareConnect mental health and wellness platform, built with Node.js, Express, and SQLite.

## 🚀 Features

- **User Management**: Patient, Volunteer, and Therapist roles with authentication
- **Real-time Chat**: WebSocket-based chat rooms for community support
- **Mood Tracking**: Daily mood logging with statistics and trends
- **Journal System**: Private journaling with mood correlation and tagging
- **Activity Management**: Community activities and events
- **Therapy Sessions**: Appointment scheduling and session management
- **User Connections**: Friend/mentor/peer connection system
- **Security**: JWT authentication, rate limiting, input validation

## 🛠️ Tech Stack

- **Runtime**: Node.js 16+
- **Framework**: Express.js
- **Database**: SQLite3
- **Authentication**: JWT (JSON Web Tokens)
- **Real-time**: Socket.IO
- **Security**: Helmet, CORS, Rate Limiting
- **Validation**: Express Validator
- **Password Hashing**: bcryptjs

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd careconnect-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Initialize Database**
   ```bash
   npm run seed
   ```

5. **Start the server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the backend directory:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Database Configuration
DB_PATH=./database/careconnect.db

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# CORS Configuration
FRONTEND_URL=http://localhost:3000

# Email Configuration (Optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

## 📚 API Documentation

### Base URL
```
http://localhost:3001/api
```

### Authentication

All protected routes require a JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Endpoints

#### Authentication (`/api/auth`)
- `POST /register` - Register new user
- `POST /login` - User login
- `GET /me` - Get current user profile
- `PUT /me` - Update user profile
- `PUT /change-password` - Change password
- `POST /logout` - Logout (client-side)

#### Users (`/api/users`)
- `GET /` - Get all users (with filtering)
- `GET /:userId` - Get specific user
- `PUT /:userId` - Update user profile
- `GET /:userId/connections` - Get user connections
- `POST /:userId/connect` - Send connection request
- `PUT /connections/:connectionId` - Accept/decline connection
- `GET /:userId/stats` - Get user statistics

#### Chat (`/api/chat`)
- `GET /rooms` - Get all chat rooms
- `GET /rooms/:roomId` - Get specific room
- `POST /rooms` - Create new room
- `GET /rooms/:roomId/messages` - Get room messages
- `POST /rooms/:roomId/messages` - Send message
- `DELETE /messages/:messageId` - Delete message
- `GET /rooms/:roomId/online` - Get online users

#### Mood Tracking (`/api/mood`)
- `GET /` - Get mood entries
- `POST /` - Add mood entry
- `PUT /:entryId` - Update mood entry
- `DELETE /:entryId` - Delete mood entry
- `GET /stats` - Get mood statistics
- `GET /today` - Get today's mood

#### Journal (`/api/journal`)
- `GET /` - Get journal entries
- `GET /:entryId` - Get specific entry
- `POST /` - Create journal entry
- `PUT /:entryId` - Update journal entry
- `DELETE /:entryId` - Delete journal entry
- `GET /stats/overview` - Get journal statistics

#### Activities (`/api/activities`)
- `GET /` - Get all activities
- `GET /:activityId` - Get specific activity
- `POST /` - Create activity
- `PUT /:activityId` - Update activity
- `DELETE /:activityId` - Delete activity
- `POST /:activityId/join` - Join activity
- `DELETE /:activityId/leave` - Leave activity
- `GET /user/my-activities` - Get user's activities

#### Therapy Sessions (`/api/therapy`)
- `GET /` - Get therapy sessions
- `GET /:sessionId` - Get specific session
- `POST /` - Create session (therapists only)
- `PUT /:sessionId` - Update session
- `DELETE /:sessionId` - Delete session
- `GET /therapists/available` - Get available therapists
- `GET /upcoming` - Get upcoming sessions

## 🔐 User Roles

### Patient
- Access to mood tracking and journaling
- Join activities and chat rooms
- Schedule therapy sessions
- Connect with other users

### Volunteer
- Similar to patients but can help others
- Access to support activities
- Can mentor other users

### Therapist
- Full access to all features
- Can create and manage therapy sessions
- Access to patient data (with permission)
- Can create activities and chat rooms

## 🗄️ Database Schema

### Core Tables
- `users` - User accounts and profiles
- `chat_rooms` - Chat room definitions
- `messages` - Chat messages
- `mood_entries` - Daily mood tracking
- `journal_entries` - Personal journal entries
- `activities` - Community activities
- `activity_participants` - Activity participation
- `therapy_sessions` - Therapy appointments
- `user_connections` - User relationships
- `notifications` - System notifications

## 🚀 Real-time Features

The API includes WebSocket support for real-time chat:

```javascript
// Connect to Socket.IO
const socket = io('http://localhost:3001');

// Join a room
socket.emit('join-room', roomId);

// Send a message
socket.emit('send-message', {
  roomId: roomId,
  content: 'Hello everyone!',
  userId: userId,
  username: username
});

// Listen for new messages
socket.on('new-message', (data) => {
  console.log('New message:', data);
});
```

## 🧪 Testing

Run the test suite:
```bash
npm test
```

## 📊 Sample Data

The database comes with sample data including:
- 2 therapists, 2 patients, 1 volunteer
- 5 chat rooms with sample messages
- 5 community activities
- Sample mood entries and journal entries
- Therapy session examples

### Test Credentials
- **Therapist**: `sarah.johnson@careconnect.com` / `password123`
- **Patient**: `mike.thompson@email.com` / `password123`
- **Volunteer**: `lisa.chen@email.com` / `password123`

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting (100 requests per 15 minutes)
- CORS protection
- Input validation and sanitization
- SQL injection prevention
- XSS protection with Helmet

## 🚀 Deployment

### Production Checklist
1. Set `NODE_ENV=production`
2. Use a strong JWT secret
3. Configure proper CORS origins
4. Set up SSL/HTTPS
5. Use a production database (PostgreSQL recommended)
6. Configure proper logging
7. Set up monitoring and error tracking

### Docker Support
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the API documentation

## 🔄 API Versioning

Current API version: `v1`
- Base URL: `/api`
- All endpoints are versioned
- Breaking changes will increment the version

---

Built with ❤️ for mental health and wellness support.