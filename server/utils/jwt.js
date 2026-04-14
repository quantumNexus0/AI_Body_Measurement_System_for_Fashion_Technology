const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'bodyfit_ai_secure_secret_2024';

const signToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    throw new Error('Invalid or expired token');
  }
};

module.exports = {
  signToken,
  verifyToken
};
