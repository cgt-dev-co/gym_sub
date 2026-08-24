const express = require('express');
const { body } = require('express-validator');
const {
  getMySubscription,
  getSubscriptionHistory,
  purchaseSubscription,
  renewSubscription,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  getSubscriptionHealth
} = require('../controllers/subscription.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');

const router = express.Router();

router.get('/my-subscription', authenticate, getMySubscription);
router.get('/history', authenticate, getSubscriptionHistory);

router.post(
  '/purchase',
  authenticate,
  [
    body('planId').notEmpty().withMessage('Plan ID is required'),
    body('paymentIntentId').notEmpty().withMessage('Payment intent ID is required'),
    validate
  ],
  purchaseSubscription
);

router.post(
  '/renew',
  authenticate,
  [
    body('subscriptionId').notEmpty().withMessage('Subscription ID is required'),
    body('paymentIntentId').notEmpty().withMessage('Payment intent ID is required'),
    validate
  ],
  renewSubscription
);

router.post(
  '/cancel',
  authenticate,
  [
    body('subscriptionId').notEmpty().withMessage('Subscription ID is required'),
    validate
  ],
  cancelSubscription
);

router.post(
  '/pause',
  authenticate,
  [
    body('subscriptionId').notEmpty().withMessage('Subscription ID is required'),
    body('pauseDays').isInt({ min: 1, max: 30 }).withMessage('Pause duration must be 1–30 days'),
    validate
  ],
  pauseSubscription
);

router.post(
  '/resume',
  authenticate,
  [
    body('subscriptionId').notEmpty().withMessage('Subscription ID is required'),
    validate
  ],
  resumeSubscription
);

router.get('/health', authenticate, getSubscriptionHealth);

module.exports = router;
