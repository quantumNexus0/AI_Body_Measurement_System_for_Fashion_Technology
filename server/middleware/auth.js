const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { createClient } = require('redis');
const { verifyToken } = require('../utils/jwt');

// Initialize Redis client for distributed rate limiting
const redisClient = createClient({ 
  url: process.env.REDIS_URL || 'redis://localhost:6379' 
});

let useRedis = false;

redisClient.on('error', (err) => {
  if (useRedis) console.warn('[auth] Redis lost connection:', err.message);
  useRedis = false;
});

redisClient.on('connect', () => {
  console.log('[auth] Redis connected successfully.');
  useRedis = true;
});

redisClient.connect().catch((err) => {
  console.warn('[auth] Redis unavailable, falling back to in-memory rate limiting.');
  useRedis = false;
});

/**
 * Rate limiter for CPU-intensive measurement requests.
 * Uses Redis store if available, falls back to in-memory if disconnected.
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
  // Fallback to memory if Redis is not explicitly needed or fails
  store: (process.env.REDIS_URL && useRedis) ? new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
  }) : undefined,
  keyGenerator: (req, res) => {
    return req.headers['x-forwarded-for']?.split(',')[0].trim()
      || req.socket?.remoteAddress
      || req.ip;
  },
  validate: { xForwardedForHeader: false },
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
