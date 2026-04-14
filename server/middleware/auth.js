const rateLimit = require('express-rate-limit');
const { verifyToken } = require('../utils/jwt');

/**
 * Rate limiter for CPU-intensive measurement requests.
 * Max 10 attempts per minute per IP.
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
