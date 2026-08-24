const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { clearUserCache, revokeToken } = require('../middleware/auth.middleware');

// NOTE: Every user update (profile, password, role, etc.) must invalidate the
// cache by calling clearUserCache(userId). This ensures the authenticate()
// middleware fetches fresh user data on the next request. See auth.middleware.js
// for the full cache invalidation contract.

const getProfile = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const subscriptions = await prisma.subscription.findMany({
      where: { userId: user.id },
      include: { plan: true, payments: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        address: user.address,
        role: user.role,
        createdAt: user.createdAt,
        subscriptions: subscriptions.map(sub => ({
          id: sub.id,
          userId: sub.userId,
          planId: sub.planId,
          status: sub.status,
          startDate: sub.startDate,
          endDate: sub.endDate,
          stripeSubscriptionId: sub.stripeSubscriptionId,
          createdAt: sub.createdAt,
          plan: { id: sub.plan.id, name: sub.plan.name, duration: sub.plan.duration, price: sub.plan.price, features: sub.plan.features },
          payments: sub.payments.map(p => ({
            id: p.id,
            userId: p.userId,
            subscriptionId: p.subscriptionId,
            amount: p.amount,
            currency: p.currency,
            status: p.status,
            stripePaymentIntentId: p.stripePaymentIntentId,
            paymentMethod: p.paymentMethod,
            createdAt: p.createdAt
          }))
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, address, currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const data = {};

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password required' });
      }

      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

      if (!isPasswordValid) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      data.password = await bcrypt.hash(newPassword, 10);
    }

    if (name) data.name = name;
    if (phone) data.phone = phone;
    if (address) data.address = address;

    const updated = await prisma.user.update({ where: { id: user.id }, data });
    clearUserCache(user.id);

    if (data.password) {
      await revokeToken(req.token);
    }

    res.json({
      message: 'Profile updated successfully',
      user: { id: updated.id, email: updated.email, name: updated.name, phone: updated.phone, address: updated.address, role: updated.role, updatedAt: updated.updatedAt }
    });
  } catch (error) {
    next(error);
  }
};

const getActivitySummary = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [workouts, classBookings, subscription] = await Promise.all([
      prisma.workoutLog.findMany({
        where: { userId, logDate: { gte: thirtyDaysAgo } },
        select: { duration: true, logDate: true },
        orderBy: { logDate: 'asc' }
      }),
      prisma.classBooking.count({
        where: { userId, status: 'CONFIRMED', createdAt: { gte: thirtyDaysAgo } }
      }),
      prisma.subscription.findFirst({
        where: { userId, status: 'ACTIVE' },
        include: { plan: true }
      })
    ]);

    const totalWorkoutMinutes = workouts.reduce((sum, w) => sum + (w.duration || 0), 0);
    const workoutDays = new Set(workouts.map(w => new Date(w.logDate).toDateString())).size;

    const weeklyBreakdown = {};
    for (const w of workouts) {
      const d = new Date(w.logDate);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toDateString();
      if (!weeklyBreakdown[key]) weeklyBreakdown[key] = { count: 0, minutes: 0 };
      weeklyBreakdown[key].count++;
      weeklyBreakdown[key].minutes += w.duration || 0;
    }

    res.json({
      activity: {
        totalWorkouts: workouts.length,
        workoutDays,
        totalWorkoutMinutes,
        avgWorkoutMinutes: workouts.length ? Math.round(totalWorkoutMinutes / workouts.length) : 0,
        classesAttended: classBookings,
        weeklyBreakdown: Object.entries(weeklyBreakdown).map(([week, v]) => ({ week, ...v })),
        hasActiveSubscription: !!subscription,
        planName: subscription?.plan?.name || null
      }
    });
  } catch (error) {
    next(error);
  }
};

const updateAvatar = async (req, res, next) => {
  try {
    const { avatarUrl } = req.body;

    if (avatarUrl && !/^https?:\/\/.+/.test(avatarUrl)) {
      return res.status(400).json({ error: 'Avatar URL must be a valid http/https URL' });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatarUrl: avatarUrl || null },
      select: { id: true, name: true, email: true, avatarUrl: true }
    });

    clearUserCache(req.user.id);
    res.json({ message: 'Avatar updated', user });
  } catch (error) {
    next(error);
  }
};

const deleteAccount = async (req, res, next) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password confirmation required' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { revokeToken } = require('../middleware/auth.middleware');
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Incorrect password' });
    }

    await prisma.subscription.updateMany({
      where: { userId: user.id, status: 'ACTIVE' },
      data: { status: 'CANCELLED' }
    });

    if (req.token) await revokeToken(req.token);

    await prisma.user.delete({ where: { id: user.id } });
    res.clearCookie('jwt', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getProfile, updateProfile, getActivitySummary, updateAvatar, deleteAccount };
