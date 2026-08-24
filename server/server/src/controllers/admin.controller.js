const prisma = require('../config/prisma');
const { clearUserCache } = require('../middleware/auth.middleware');

const getStats = async (req, res, next) => {
  try {
    const [totalUsers, activeSubscriptions, totalRevenue, pendingBookings] = await Promise.all([
      prisma.user.count({ where: { role: 'USER' } }),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.payment.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true }
      }),
      prisma.classBooking.count({ where: { status: 'CONFIRMED' } })
    ]);

    const recentSignups = await prisma.user.findMany({
      where: { role: 'USER' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, name: true, email: true, createdAt: true }
    });

    res.json({
      stats: {
        totalUsers,
        activeSubscriptions,
        totalRevenue: totalRevenue._sum.amount || 0,
        pendingBookings
      },
      recentSignups
    });
  } catch (error) {
    next(error);
  }
};

const getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = search
      ? { OR: [{ name: { contains: search } }, { email: { contains: search } }] }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          createdAt: true,
          subscriptions: {
            where: { status: 'ACTIVE' },
            take: 1,
            include: { plan: { select: { name: true } } }
          }
        }
      }),
      prisma.user.count({ where })
    ]);

    res.json({ users, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    next(error);
  }
};

const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['USER', 'ADMIN'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot modify your own role' });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, name: true, email: true, role: true }
    });

    clearUserCache(id);

    res.json({ message: 'User role updated', user });
  } catch (error) {
    next(error);
  }
};

const getAllSubscriptions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = status ? { status } : {};

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          plan: { select: { id: true, name: true, price: true, duration: true } }
        }
      }),
      prisma.subscription.count({ where })
    ]);

    res.json({ subscriptions, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await prisma.user.delete({ where: { id } });
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const getRevenueAnalytics = async (req, res, next) => {
  try {
    const { period = 'monthly', year } = req.query;
    const targetYear = parseInt(year) || new Date().getFullYear();

    const startOfYear = new Date(targetYear, 0, 1);
    const endOfYear = new Date(targetYear, 11, 31, 23, 59, 59);

    const payments = await prisma.payment.findMany({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: startOfYear, lte: endOfYear }
      },
      select: { amount: true, createdAt: true, currency: true },
      orderBy: { createdAt: 'asc' }
    });

    const buckets = {};

    for (const payment of payments) {
      const d = new Date(payment.createdAt);
      let key;
      if (period === 'monthly') {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      } else if (period === 'quarterly') {
        key = `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
      } else {
        key = `${d.getFullYear()}`;
      }

      if (!buckets[key]) buckets[key] = { revenue: 0, count: 0, currency: payment.currency };
      buckets[key].revenue += payment.amount;
      buckets[key].count++;
    }

    const data = Object.entries(buckets).map(([period, v]) => ({ period, ...v }));
    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);

    const planRevenue = await prisma.payment.groupBy({
      by: ['subscriptionId'],
      where: { status: 'COMPLETED', createdAt: { gte: startOfYear, lte: endOfYear } },
      _sum: { amount: true }
    });

    res.json({ analytics: { data, totalRevenue, paymentCount: payments.length, year: targetYear } });
  } catch (error) {
    next(error);
  }
};

const getUserActivity = async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));

    const [newUsers, activeSubscribers, workoutsLogged, classesBooked] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: since }, role: 'USER' } }),
      prisma.subscription.count({ where: { status: 'ACTIVE', updatedAt: { gte: since } } }),
      prisma.workoutLog.count({ where: { logDate: { gte: since } } }),
      prisma.classBooking.count({ where: { status: 'CONFIRMED', createdAt: { gte: since } } })
    ]);

    const topWorkoutUsers = await prisma.workoutLog.groupBy({
      by: ['userId'],
      where: { logDate: { gte: since } },
      _count: { userId: true },
      orderBy: { _count: { userId: 'desc' } },
      take: 5
    });

    const userIds = topWorkoutUsers.map(u => u.userId);
    const userNames = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true }
    });

    const nameMap = Object.fromEntries(userNames.map(u => [u.id, u]));
    const topUsers = topWorkoutUsers.map(u => ({
      ...nameMap[u.userId],
      workoutCount: u._count.userId
    }));

    res.json({
      activity: { newUsers, activeSubscribers, workoutsLogged, classesBooked, topUsers, periodDays: parseInt(days) }
    });
  } catch (error) {
    next(error);
  }
};

const getPlanPopularity = async (req, res, next) => {
  try {
    const planStats = await prisma.subscription.groupBy({
      by: ['planId'],
      _count: { planId: true },
      orderBy: { _count: { planId: 'desc' } }
    });

    const planIds = planStats.map(p => p.planId);
    const plans = await prisma.plan.findMany({ where: { id: { in: planIds } } });
    const planMap = Object.fromEntries(plans.map(p => [p.id, p]));

    const result = planStats.map(s => ({
      plan: planMap[s.planId],
      totalSubscriptions: s._count.planId
    }));

    res.json({ planPopularity: result });
  } catch (error) {
    next(error);
  }
};

const suspendUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot suspend your own account' });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { isSuspended: true, suspendedReason: reason || null },
      select: { id: true, name: true, email: true, isSuspended: true }
    });

    clearUserCache(id);

    await prisma.notification.create({
      data: {
        userId: id,
        title: 'Account Suspended',
        message: reason ? `Your account has been suspended: ${reason}` : 'Your account has been suspended. Please contact support.',
        type: 'ERROR'
      }
    });

    res.json({ message: 'User suspended', user });
  } catch (error) {
    next(error);
  }
};

const unsuspendUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.update({
      where: { id },
      data: { isSuspended: false, suspendedReason: null },
      select: { id: true, name: true, email: true, isSuspended: true }
    });

    clearUserCache(id);
    res.json({ message: 'User unsuspended', user });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStats, getUsers, updateUserRole, getAllSubscriptions, deleteUser,
  getRevenueAnalytics, getUserActivity, getPlanPopularity, suspendUser, unsuspendUser
};
