const jwt = require('jsonwebtoken');
const { User } = require('../models');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id);
    
    if (!user || !user.is_active) {
      return res.status(401).json({ message: 'Invalid token or user not active.' });
    }

    req.user = user.getSafeData();
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired.' });
    }
    res.status(500).json({ message: 'Server error during authentication.' });
  }
};

// Role-based access control middleware
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Access denied. Required roles: ${roles.join(', ')}` 
      });
    }
    
    next();
  };
};

// Check if user owns the resource or has appropriate role
const requireOwnershipOrRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    
    const resourceUserId = req.params.userId || req.body.user_id || req.params.id;
    const isOwner = req.user.id === resourceUserId;
    const hasRole = roles.includes(req.user.role);
    
    if (!isOwner && !hasRole) {
      return res.status(403).json({ 
        message: 'Access denied. You can only access your own resources or need appropriate role.' 
      });
    }
    
    next();
  };
};

module.exports = {
  authMiddleware,
  requireRole,
  requireOwnershipOrRole
};