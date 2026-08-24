const prisma = require('../config/prisma');

const getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.notification.count({ where: { userId: req.user.id } }),
      prisma.notification.count({ where: { userId: req.user.id, isRead: false } })
    ]);

    res.json({ notifications, total, unreadCount, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    next(error);
  }
};

const getUnreadCount = async (req, res, next) => {
  try {
    const unreadCount = await prisma.notification.count({
      where: { userId: req.user.id, isRead: false }
    });
    res.json({ unreadCount });
  } catch (error) {
    next(error);
  }
};

const markRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.findFirst({
      where: { id, userId: req.user.id }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await prisma.notification.update({ where: { id }, data: { isRead: true } });
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    next(error);
  }
};

const markAllRead = async (req, res, next) => {
  try {
    const { count } = await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true }
    });
    res.json({ message: `Marked ${count} notifications as read` });
  } catch (error) {
    next(error);
  }
};

const deleteNotification = async (req, res, next) => {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.findFirst({
      where: { id, userId: req.user.id }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await prisma.notification.delete({ where: { id } });
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    next(error);
  }
};

const broadcastNotification = async (req, res, next) => {
  try {
    const { title, message, type = 'INFO', userIds } = req.body;

    let targetUserIds = userIds;

    if (!targetUserIds || targetUserIds.length === 0) {
      const users = await prisma.user.findMany({ select: { id: true } });
      targetUserIds = users.map(u => u.id);
    }

    await prisma.notification.createMany({
      data: targetUserIds.map(userId => ({ userId, title, message, type }))
    });

    res.json({ message: `Notification sent to ${targetUserIds.length} users` });
  } catch (error) {
    next(error);
  }
};

const deleteAllNotifications = async (req, res, next) => {
  try {
    const { count } = await prisma.notification.deleteMany({ where: { userId: req.user.id } });
    res.json({ message: `Deleted ${count} notifications` });
  } catch (error) {
    next(error);
  }
};

const getNotificationsByType = async (req, res, next) => {
  try {
    const { type } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const validTypes = ['INFO', 'SUCCESS', 'WARNING', 'ERROR'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid notification type' });
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user.id, type },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.notification.count({ where: { userId: req.user.id, type } })
    ]);

    res.json({ notifications, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    next(error);
  }
};

const getNotificationSummary = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [total, unread, byType] = await Promise.all([
      prisma.notification.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, isRead: false } }),
      prisma.notification.groupBy({
        by: ['type'],
        where: { userId },
        _count: { type: true }
      })
    ]);

    const typeBreakdown = {};
    for (const row of byType) {
      typeBreakdown[row.type] = row._count.type;
    }

    res.json({ summary: { total, unread, typeBreakdown } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications, getUnreadCount, markRead, markAllRead, deleteNotification, broadcastNotification,
  deleteAllNotifications, getNotificationsByType, getNotificationSummary
};
