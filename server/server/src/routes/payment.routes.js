const express = require('express');
const { body } = require('express-validator');
const {
  createPaymentIntent,
  handleWebhook,
  getPaymentHistory
} = require('../controllers/payment.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');

const router = express.Router();

router.post(
  '/create-payment-intent',
  authenticate,
  [
    body('planId')
        .notEmpty().withMessage('Plan ID is required')
        .isString().withMessage('Plan ID must be a string'),
    validate
  ],
  createPaymentIntent
);

router.post('/webhook', handleWebhook);

router.get('/history', authenticate, getPaymentHistory);

module.exports = router;
