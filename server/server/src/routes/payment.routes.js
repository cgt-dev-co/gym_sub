const express = require('express');
const { body } = require('express-validator');
const {
  createPaymentIntent,
  handleWebhook,
  getPaymentHistory,
  getPaymentSummary,
  getPaymentReceipt,
  getAdminPaymentAnalytics
} = require('../controllers/payment.controller');
const { authenticate, isAdmin } = require('../middleware/auth.middleware');
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
router.get('/summary', authenticate, getPaymentSummary);
router.get('/receipt/:id', authenticate, getPaymentReceipt);
router.get('/admin/analytics', authenticate, isAdmin, getAdminPaymentAnalytics);

module.exports = router;
