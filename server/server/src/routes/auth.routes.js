const express = require('express');
const { body } = require('express-validator');
const { register, login, getMe, logout } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.post(
  '/register',
  registerLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
    body('name').notEmpty().withMessage('Name is required'),
    validate
  ],
  register
);

router.post(
  '/login',
  loginLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
    validate
  ],
  login
);

router.get('/me', authenticate, getMe);

router.post('/logout', authenticate, logout);

module.exports = router;
