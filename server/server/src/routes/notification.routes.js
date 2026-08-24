const express = require('express');
const router = express.Router();
const { authenticate, isAdmin } = require('../middleware/auth.middleware');
const {
  getNotifications, getUnreadCount, markRead, markAllRead, deleteNotification, broadcastNotification,
  deleteAllNotifications, getNotificationsByType, getNotificationSummary
} = require('../controllers/notification.controller');

router.use(authenticate);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.get('/summary', getNotificationSummary);
router.get('/type/:type', getNotificationsByType);
router.put('/:id/read', markRead);
router.put('/read-all', markAllRead);
router.delete('/all', deleteAllNotifications);
router.delete('/:id', deleteNotification);

router.post('/broadcast', isAdmin, broadcastNotification);

module.exports = router;
