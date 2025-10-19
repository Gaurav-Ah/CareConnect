const jwt = require('jsonwebtoken');
const { db } = require('../config/database');

// Verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Check if user has specific role
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Check if user can access resource (own data or admin)
const requireOwnershipOrRole = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const resourceUserId = parseInt(req.params.userId || req.params.id);
    const currentUserId = req.user.id;

    // Allow if user owns the resource or has required role
    if (currentUserId === resourceUserId || roles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({ error: 'Access denied' });
  };
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      req.user = null;
    } else {
      req.user = user;
    }
    next();
  });
};

// Verify user exists and is active
const verifyUser = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const sql = 'SELECT id, name, email, role, is_verified FROM users WHERE id = ?';
  
  db.get(sql, [req.user.id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (!user.is_verified) {
      return res.status(403).json({ error: 'Account not verified' });
    }

    req.user = { ...req.user, ...user };
    next();
  });
};

module.exports = {
  authenticateToken,
  requireRole,
  requireOwnershipOrRole,
  optionalAuth,
  verifyUser
};