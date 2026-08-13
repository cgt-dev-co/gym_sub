const express = require('express');
const { body } = require('express-validator');
const {
  getMySubscription,
  getSubscriptionHistory,
  purchaseSubscription,
  renewSubscription,
  cancelSubscription
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
    validate
  ],
  purchaseSubscription
);

router.post(
  '/renew',
  authenticate,
  [
    body('subscriptionId').notEmpty().withMessage('Subscription ID is required'),
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

module.exports = router;
