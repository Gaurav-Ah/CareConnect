const { ChatMessage, User } = require('../models');

module.exports = (io, socket) => {
  console.log(`User ${socket.userId} connected with role: ${socket.userRole}`);

  // Join user to their personal room for direct messages
  socket.join(`user_${socket.userId}`);

  // Handle joining chat rooms
  socket.on('join_room', (roomName) => {
    socket.join(roomName);
    socket.to(roomName).emit('user_joined', {
      user_id: socket.userId,
      message: `User joined the room`
    });
    console.log(`User ${socket.userId} joined room: ${roomName}`);
  });

  // Handle leaving chat rooms
  socket.on('leave_room', (roomName) => {
    socket.leave(roomName);
    socket.to(roomName).emit('user_left', {
      user_id: socket.userId,
      message: `User left the room`
    });
    console.log(`User ${socket.userId} left room: ${roomName}`);
  });

  // Handle real-time messaging
  socket.on('send_message', async (data) => {
    try {
      const { recipient_id, message, message_type = 'text', chat_room, is_ai_chat = false } = data;

      // Validate message
      if (!message || message.trim().length === 0) {
        socket.emit('error', { message: 'Message cannot be empty' });
        return;
      }

      if (message.length > 2000) {
        socket.emit('error', { message: 'Message too long' });
        return;
      }

      // Get sender information
      const sender = await User.findByPk(socket.userId, {
        attributes: ['id', 'first_name', 'last_name', 'profile_picture', 'role']
      });

      if (!sender) {
        socket.emit('error', { message: 'Sender not found' });
        return;
      }

      // Create message in database
      const chatMessage = await ChatMessage.create({
        sender_id: socket.userId,
        recipient_id: is_ai_chat ? null : recipient_id,
        message: message.trim(),
        message_type,
        chat_room,
        is_ai_chat
      });

      const messageData = {
        id: chatMessage.id,
        sender_id: socket.userId,
        sender_name: `${sender.first_name} ${sender.last_name}`,
        sender_role: sender.role,
        message: chatMessage.message,
        message_type: chatMessage.message_type,
        created_at: chatMessage.created_at,
        chat_room: chatMessage.chat_room,
        is_ai_chat: chatMessage.is_ai_chat
      };

      // Send to appropriate recipients
      if (recipient_id && !is_ai_chat) {
        // Direct message
        io.to(`user_${recipient_id}`).emit('new_message', messageData);
        socket.emit('message_sent', messageData);
      } else if (chat_room) {
        // Room message
        socket.to(chat_room).emit('new_message', messageData);
        socket.emit('message_sent', messageData);
      } else if (is_ai_chat) {
        // AI chat - simulate AI response (you would integrate with actual AI service)
        socket.emit('message_sent', messageData);
        
        // Simulate AI response after a short delay
        setTimeout(async () => {
          const aiResponse = await generateAIResponse(message, socket.userId);
          const aiMessage = await ChatMessage.create({
            sender_id: null, // AI has no user ID
            recipient_id: socket.userId,
            message: aiResponse,
            message_type: 'ai_response',
            is_ai_chat: true,
            ai_context: { user_message: message }
          });

          socket.emit('new_message', {
            id: aiMessage.id,
            sender_id: null,
            sender_name: 'CareConnect AI',
            sender_role: 'ai',
            message: aiMessage.message,
            message_type: 'ai_response',
            created_at: aiMessage.created_at,
            is_ai_chat: true
          });
        }, 1000 + Math.random() * 2000); // Random delay between 1-3 seconds
      }

    } catch (error) {
      console.error('Socket message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle typing indicators
  socket.on('typing_start', (data) => {
    const { recipient_id, chat_room } = data;
    
    if (recipient_id) {
      socket.to(`user_${recipient_id}`).emit('user_typing', {
        user_id: socket.userId,
        typing: true
      });
    } else if (chat_room) {
      socket.to(chat_room).emit('user_typing', {
        user_id: socket.userId,
        typing: true,
        room: chat_room
      });
    }
  });

  socket.on('typing_stop', (data) => {
    const { recipient_id, chat_room } = data;
    
    if (recipient_id) {
      socket.to(`user_${recipient_id}`).emit('user_typing', {
        user_id: socket.userId,
        typing: false
      });
    } else if (chat_room) {
      socket.to(chat_room).emit('user_typing', {
        user_id: socket.userId,
        typing: false,
        room: chat_room
      });
    }
  });

  // Handle message read receipts
  socket.on('message_read', async (data) => {
    try {
      const { message_id } = data;
      
      await ChatMessage.update(
        { is_read: true, read_at: new Date() },
        { where: { id: message_id, recipient_id: socket.userId } }
      );

      // Notify sender that message was read
      const message = await ChatMessage.findByPk(message_id);
      if (message && message.sender_id) {
        io.to(`user_${message.sender_id}`).emit('message_read_receipt', {
          message_id,
          read_by: socket.userId,
          read_at: new Date()
        });
      }
    } catch (error) {
      console.error('Message read error:', error);
    }
  });

  // Handle user status updates
  socket.on('update_status', (status) => {
    socket.broadcast.emit('user_status_update', {
      user_id: socket.userId,
      status,
      timestamp: new Date()
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User ${socket.userId} disconnected`);
    
    // Notify others that user went offline
    socket.broadcast.emit('user_status_update', {
      user_id: socket.userId,
      status: 'offline',
      timestamp: new Date()
    });
  });

  // Handle errors
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
};

// Simple AI response generator (replace with actual AI service integration)
async function generateAIResponse(userMessage, userId) {
  const responses = {
    greeting: [
      "Hello! I'm here to support you. How are you feeling today?",
      "Hi there! I'm glad you reached out. What's on your mind?",
      "Welcome! I'm here to listen and help. How can I support you today?"
    ],
    mood: [
      "I understand you're going through a difficult time. Remember that it's okay to feel this way, and you're not alone.",
      "Thank you for sharing how you're feeling. Your emotions are valid, and it's brave of you to express them.",
      "I hear you. It sounds like you're dealing with a lot right now. Would you like to talk about what's contributing to these feelings?"
    ],
    support: [
      "You're taking an important step by reaching out. That shows real strength and self-awareness.",
      "Remember that healing isn't linear, and it's okay to have ups and downs. You're doing better than you think.",
      "I'm here to support you through this. Have you tried any coping strategies that have helped you before?"
    ],
    encouragement: [
      "You've overcome challenges before, and you have the strength to get through this too.",
      "Every small step you take towards feeling better matters. Be patient and kind with yourself.",
      "You're not alone in this journey. There are people who care about you and want to help."
    ],
    default: [
      "I'm here to listen. Can you tell me more about what you're experiencing?",
      "Thank you for sharing that with me. How are you feeling about the situation?",
      "I understand. Would you like to explore this topic further, or is there something else on your mind?"
    ]
  };

  const lowerMessage = userMessage.toLowerCase();
  let responseCategory = 'default';

  if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
    responseCategory = 'greeting';
  } else if (lowerMessage.includes('sad') || lowerMessage.includes('depressed') || lowerMessage.includes('anxious') || lowerMessage.includes('worried')) {
    responseCategory = 'mood';
  } else if (lowerMessage.includes('help') || lowerMessage.includes('support') || lowerMessage.includes('struggling')) {
    responseCategory = 'support';
  } else if (lowerMessage.includes('better') || lowerMessage.includes('good') || lowerMessage.includes('happy')) {
    responseCategory = 'encouragement';
  }

  const categoryResponses = responses[responseCategory];
  const randomResponse = categoryResponses[Math.floor(Math.random() * categoryResponses.length)];

  return randomResponse;
}