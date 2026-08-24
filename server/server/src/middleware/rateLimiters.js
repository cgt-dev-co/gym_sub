const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    error: 'Too many login attempts. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by email address to block distributed attacks targeting one account
    return req.body?.email || req.ip;
  }
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    error: 'Too many registration attempts. Please try again after 1 hour.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body?.email || req.ip,
});

module.exports = { loginLimiter, registerLimiter };
