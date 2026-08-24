const express = require('express');
const { getProfile, updateProfile, getActivitySummary, updateAvatar, deleteAccount } = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.get('/activity', authenticate, getActivitySummary);
router.put('/avatar', authenticate, updateAvatar);
router.delete('/account', authenticate, deleteAccount);

module.exports = router;
