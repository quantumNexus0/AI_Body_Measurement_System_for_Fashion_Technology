/**
 * Environment variable validation and configuration.
 * Fails fast at startup if critical security settings are missing or weak.
 */
function validateEnv() {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    throw new Error('FATAL: JWT_SECRET environment variable is required for API security.');
  }
  
  if (secret.length < 32) {
    throw new Error('FATAL: JWT_SECRET must be at least 32 characters long to prevent brute-force attacks.');
  }

  const defaults = ['secret', 'changeme', 'bodyfit_ai_secure_secret_2024'];
  if (defaults.includes(secret)) {
    throw new Error('FATAL: JWT_SECRET must not use a default or example value.');
  }

  return {
    jwtSecret: secret,
    port: Number(process.env.PORT) || 3001,
    nodeEnv: process.env.NODE_ENV || 'development',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379'
  };
}

module.exports = { validateEnv };
