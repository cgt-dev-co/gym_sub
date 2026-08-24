const express = require('express');
const { body } = require('express-validator');
const {
  getAllPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan
} = require('../controllers/plan.controller');
const { authenticate, isAdmin } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');

const router = express.Router();

router.get('/', getAllPlans);
router.get('/:id', getPlanById);

router.post(
  '/',
  authenticate,
  isAdmin,
  [
    body('name').notEmpty().withMessage('Plan name is required'),
    body('duration')
      .isIn(['MONTHLY', 'QUARTERLY', 'YEARLY'])
      .withMessage('Invalid duration'),
    body('price').isFloat({ min: 0 }).withMessage('Valid price is required'),
    body('currency')
      .optional()
      .isLength({ min: 3, max: 3 })
      .isAlpha()
      .toUpperCase()
      .withMessage('Currency must be a 3-letter ISO code (e.g. USD, EUR)'),
    validate
  ],
  createPlan
);

router.put('/:id', authenticate, isAdmin, updatePlan);
router.delete('/:id', authenticate, isAdmin, deletePlan);

module.exports = router;
