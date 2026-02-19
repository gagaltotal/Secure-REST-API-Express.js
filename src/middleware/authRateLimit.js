const rateLimit = require('express-rate-limit');

// Limit attempts by email when present to prevent abuse even behind shared IPs
const keyByEmailOrIP = (req) => {
  if (req.body && req.body.email) return String(req.body.email).toLowerCase();
  if (req.query && req.query.email) return String(req.query.email).toLowerCase();
  return req.ip;
};

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Too many registration attempts, try again later' },
  keyGenerator: keyByEmailOrIP,
  standardHeaders: true,
  legacyHeaders: false
});

const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many password reset requests, try again later' },
  keyGenerator: keyByEmailOrIP,
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = { registerLimiter, forgotLimiter };
