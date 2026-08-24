const express = require('express');
const router = express.Router();
const { authenticate, isAdmin } = require('../middleware/auth.middleware');
const {
  getStats, getUsers, updateUserRole, getAllSubscriptions, deleteUser,
  getRevenueAnalytics, getUserActivity, getPlanPopularity, suspendUser, unsuspendUser
} = require('../controllers/admin.controller');

router.use(authenticate, isAdmin);

router.get('/stats', getStats);
router.get('/users', getUsers);
router.put('/users/:id/role', updateUserRole);
router.put('/users/:id/suspend', suspendUser);
router.put('/users/:id/unsuspend', unsuspendUser);
router.delete('/users/:id', deleteUser);
router.get('/subscriptions', getAllSubscriptions);
router.get('/analytics/revenue', getRevenueAnalytics);
router.get('/analytics/activity', getUserActivity);
router.get('/analytics/plans', getPlanPopularity);

module.exports = router;
