const express = require('express');
const router = express.Router();
const { authenticate, isAdmin } = require('../middleware/auth.middleware');
const { getStats, getUsers, updateUserRole, getAllSubscriptions, deleteUser } = require('../controllers/admin.controller');

router.use(authenticate, isAdmin);

router.get('/stats', getStats);
router.get('/users', getUsers);
router.put('/users/:id/role', updateUserRole);
router.delete('/users/:id', deleteUser);
router.get('/subscriptions', getAllSubscriptions);

module.exports = router;
