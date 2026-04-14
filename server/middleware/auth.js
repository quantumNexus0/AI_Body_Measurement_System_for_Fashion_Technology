const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { createClient } = require('redis');
const { verifyToken } = require('../utils/jwt');

// Initialize Redis client for distributed rate limiting
const redisClient = createClient({ 
  url: process.env.REDIS_URL || 'redis://localhost:6379' 
});

redisClient.connect().catch((err) => {
  console.error('[auth] Redis Connection Error:', err.message);
});

/**
 * Rate limiter for CPU-intensive measurement requests.
 * Uses Redis store for distributed application support.
 */
const measureLimiter = rateLimit({
  windowMs: 60 * 1000, 
  max: 10,
  message: { 
    success: false,
    error: 'Too many measurement requests. Please wait a minute.' 
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
  }),
  keyGenerator: (req) => {
    // Rate limit per user if authed, otherwise per IP
    return req.user?.id || req.ip;
  }
});

/**
 * Middleware to ensure request has a valid JWT token.
 */
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      success: false,
      error: 'Authentication required. Missing Bearer token.' 
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ 
      success: false,
      error: 'Invalid or expired authentication token.' 
    });
  }
};

module.exports = {
  measureLimiter,
  requireAuth
};
