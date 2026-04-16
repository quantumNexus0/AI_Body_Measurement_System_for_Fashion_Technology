const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { createClient } = require('redis');
const { verifyToken } = require('../utils/jwt');

// ✅ Create Redis client
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

let useRedis = false;

// ✅ Redis event handling (log only once to avoid spam)
let redisConnected = false;
redisClient.on('error', (err) => {
  if (redisConnected || !useRedis) {
    // Only warn if we were previously connected or it's the first time
    if (useRedis) console.warn('[auth] Redis connection lost:', err.message);
  }
  useRedis = false;
  redisConnected = false;
});

redisClient.on('connect', () => {
  console.log('[auth] Redis connected successfully.');
  useRedis = true;
});

// ✅ Connect Redis
(async () => {
  try {
    await redisClient.connect();
    useRedis = true;
  } catch (err) {
    console.warn('[auth] Redis unavailable, using memory store.');
    useRedis = false;
  }
})();

/**
 * ✅ Rate limiter for measurement API
 */
const measureLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: {
    success: false,
    error: 'Too many measurement requests. Please wait a minute.'
  },
  standardHeaders: true,
  legacyHeaders: false,

  // ✅ Use Redis only if available
  store: useRedis
    ? new RedisStore({
        sendCommand: (...args) => redisClient.sendCommand(args),
      })
    : undefined
});

/**
 * ✅ General API limiter (optional)
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100
});

/**
 * ✅ JWT Authentication Middleware
 */
const requireAuth = (req, res, next) => {
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
  apiLimiter,
  requireAuth
};