const express = require('express');
const router = express.Router();
const { authenticate, isAdmin } = require('../middleware/auth.middleware');
const { getNotifications, getUnreadCount, markRead, markAllRead, deleteNotification, broadcastNotification } = require('../controllers/notification.controller');

router.use(authenticate);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.put('/:id/read', markRead);
router.put('/read-all', markAllRead);
router.delete('/:id', deleteNotification);

router.post('/broadcast', isAdmin, broadcastNotification);

module.exports = router;
