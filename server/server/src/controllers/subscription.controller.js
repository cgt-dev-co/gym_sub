const prisma = require('../config/prisma');

// KNOWN BUGS
// Bug 1 — Race condition on concurrent purchase: two simultaneous requests for the same
//   user can both pass the "no active subscription" check before either creates the row,
//   resulting in duplicate active subscriptions. The subscription.create and the active
//   check should be wrapped in a Prisma interactive transaction.
//
// Bug 2 — FIXED: renewSubscription() now uses max(now, subscription.endDate) as the
//   new startDate, so users who renew before expiry preserve their remaining days. The
//   fix is on the startDate assignment inside renewSubscription().
//
// Bug 3 — No transaction wrapping purchase: subscription.create and payment.update run as
//   two separate Prisma calls. If the server crashes between them, the subscription is
//   activated but the payment row never has its subscriptionId set, leaving the payment
//   reusable for a second subscription purchase.

const getMySubscription = async (req, res, next) => {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: { userId: req.user.id, status: 'ACTIVE' },
      include: { plan: true, payments: { orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'desc' }
    });

    if (!subscription) {
      return res.json({ subscription: null });
    }

    res.json({
      subscription: {
        id: subscription.id,
        userId: subscription.userId,
        planId: subscription.planId,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,
        plan: { id: subscription.plan.id, name: subscription.plan.name, duration: subscription.plan.duration, price: subscription.plan.price, features: subscription.plan.features },
        payments: subscription.payments.map(p => ({
          id: p.id, userId: p.userId, subscriptionId: p.subscriptionId, amount: p.amount,
          currency: p.currency, status: p.status, stripePaymentIntentId: p.stripePaymentIntentId,
          paymentMethod: p.paymentMethod, createdAt: p.createdAt
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

const getSubscriptionHistory = async (req, res, next) => {
  try {
    const subscriptions = await prisma.subscription.findMany({
      where: { userId: req.user.id },
      include: { plan: true, payments: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      subscriptions: subscriptions.map(sub => ({
        id: sub.id,
        userId: sub.userId,
        planId: sub.planId,
        status: sub.status,
        startDate: sub.startDate,
        endDate: sub.endDate,
        stripeSubscriptionId: sub.stripeSubscriptionId,
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt,
        plan: { id: sub.plan.id, name: sub.plan.name, duration: sub.plan.duration, price: sub.plan.price, features: sub.plan.features },
        payments: sub.payments.map(p => ({
          id: p.id, userId: p.userId, subscriptionId: p.subscriptionId, amount: p.amount,
          currency: p.currency, status: p.status, stripePaymentIntentId: p.stripePaymentIntentId,
          paymentMethod: p.paymentMethod, createdAt: p.createdAt
        }))
      }))
    });
  } catch (error) {
    next(error);
  }
};

const purchaseSubscription = async (req, res, next) => {
  try {
    const { planId, paymentIntentId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({ error: 'Payment intent ID is required' });
    }

    const plan = await prisma.plan.findUnique({ where: { id: planId } });

    if (!plan || !plan.isActive) {
      return res.status(404).json({ error: 'Plan not found or inactive' });
    }

    const payment = await prisma.payment.findFirst({ where: { stripePaymentIntentId: paymentIntentId } });

    if (!payment) {
      return res.status(400).json({ error: 'Payment not found' });
    }
    if (payment.status === 'FAILED') {
      return res.status(400).json({ error: 'Payment failed' });
    }
    if (payment.status !== 'COMPLETED') {
      return res.status(402).json({ error: 'Payment not completed' });
    }
    if (payment.userId !== req.user.id) {
      return res.status(403).json({ error: 'Payment does not belong to this user' });
    }
    if (payment.subscriptionId) {
      return res.status(400).json({ error: 'Payment already used for a subscription' });
    }

    const existingActive = await prisma.subscription.findFirst({
      where: { userId: req.user.id, status: 'ACTIVE' }
    });

    if (existingActive) {
      return res.status(400).json({ error: 'You already have an active subscription' });
    }

    const startDate = new Date();
    const endDate = new Date(startDate);
    if (plan.duration === 'MONTHLY') endDate.setMonth(endDate.getMonth() + 1);
    else if (plan.duration === 'QUARTERLY') endDate.setMonth(endDate.getMonth() + 3);
    else if (plan.duration === 'YEARLY') endDate.setFullYear(endDate.getFullYear() + 1);

    const subscription = await prisma.subscription.create({
      data: { userId: req.user.id, planId: plan.id, status: 'ACTIVE', startDate, endDate },
      include: { plan: true }
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { subscriptionId: subscription.id }
    });

    res.status(201).json({
      message: 'Subscription purchased successfully',
      subscription: {
        id: subscription.id,
        userId: subscription.userId,
        planId: subscription.planId,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,
        plan: { id: subscription.plan.id, name: subscription.plan.name, duration: subscription.plan.duration, price: subscription.plan.price, features: subscription.plan.features }
      }
    });
  } catch (error) {
    next(error);
  }
};

const renewSubscription = async (req, res, next) => {
  try {
    const { subscriptionId, paymentIntentId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({ error: 'Payment intent ID is required' });
    }

    const subscription = await prisma.subscription.findFirst({
      where: { id: subscriptionId, userId: req.user.id },
      include: { plan: true }
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const payment = await prisma.payment.findFirst({ where: { stripePaymentIntentId: paymentIntentId } });

    if (!payment) {
      return res.status(400).json({ error: 'Payment not found' });
    }
    if (payment.status === 'FAILED') {
      return res.status(400).json({ error: 'Payment failed' });
    }
    if (payment.status !== 'COMPLETED') {
      return res.status(402).json({ error: 'Payment not completed' });
    }
    if (payment.userId !== req.user.id) {
      return res.status(403).json({ error: 'Payment does not belong to this user' });
    }
    if (payment.subscriptionId && payment.subscriptionId !== subscriptionId) {
      return res.status(400).json({ error: 'Payment already used for a different subscription' });
    }

    // Use max(now, current endDate) so a renewal before expiry doesn't lose remaining days
    const startDate = new Date(Math.max(Date.now(), subscription.endDate?.getTime() || Date.now()));
    const endDate = new Date(startDate);
    if (subscription.plan.duration === 'MONTHLY') endDate.setMonth(endDate.getMonth() + 1);
    else if (subscription.plan.duration === 'QUARTERLY') endDate.setMonth(endDate.getMonth() + 3);
    else if (subscription.plan.duration === 'YEARLY') endDate.setFullYear(endDate.getFullYear() + 1);

    const updated = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'ACTIVE', startDate, endDate },
      include: { plan: true }
    });

    if (!payment.subscriptionId) {
      await prisma.payment.update({ where: { id: payment.id }, data: { subscriptionId } });
    }

    res.json({
      message: 'Subscription renewed successfully',
      subscription: {
        id: updated.id,
        userId: updated.userId,
        planId: updated.planId,
        status: updated.status,
        startDate: updated.startDate,
        endDate: updated.endDate,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        plan: { id: updated.plan.id, name: updated.plan.name, duration: updated.plan.duration, price: updated.plan.price, features: updated.plan.features }
      }
    });
  } catch (error) {
    next(error);
  }
};

const cancelSubscription = async (req, res, next) => {
  try {
    const { subscriptionId } = req.body;

    const existing = await prisma.subscription.findFirst({
      where: { id: subscriptionId, userId: req.user.id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const subscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'CANCELLED' }
    });

    res.json({
      message: 'Subscription cancelled successfully',
      subscription: {
        id: subscription.id,
        userId: subscription.userId,
        planId: subscription.planId,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

const pauseSubscription = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { subscriptionId, pauseDays } = req.body;

    if (!pauseDays || pauseDays < 1 || pauseDays > 30) {
      return res.status(400).json({ error: 'Pause duration must be 1–30 days' });
    }

    const subscription = await prisma.subscription.findFirst({
      where: { id: subscriptionId, userId, status: 'ACTIVE' }
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Active subscription not found' });
    }

    if (subscription.pausedAt) {
      return res.status(400).json({ error: 'Subscription is already paused' });
    }

    const resumeDate = new Date();
    resumeDate.setDate(resumeDate.getDate() + parseInt(pauseDays));

    const newEndDate = new Date(subscription.endDate);
    newEndDate.setDate(newEndDate.getDate() + parseInt(pauseDays));

    const updated = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'PAUSED',
        pausedAt: new Date(),
        resumeDate,
        endDate: newEndDate
      },
      include: { plan: true }
    });

    await prisma.notification.create({
      data: {
        userId,
        title: 'Subscription Paused',
        message: `Your subscription has been paused for ${pauseDays} days. It will resume on ${resumeDate.toLocaleDateString()} and your end date has been extended accordingly.`,
        type: 'INFO'
      }
    });

    res.json({
      message: `Subscription paused for ${pauseDays} days`,
      subscription: {
        id: updated.id,
        status: updated.status,
        pausedAt: updated.pausedAt,
        resumeDate: updated.resumeDate,
        endDate: updated.endDate,
        plan: { name: updated.plan.name }
      }
    });
  } catch (error) {
    next(error);
  }
};

const resumeSubscription = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { subscriptionId } = req.body;

    const subscription = await prisma.subscription.findFirst({
      where: { id: subscriptionId, userId, status: 'PAUSED' }
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Paused subscription not found' });
    }

    const pausedAt = new Date(subscription.pausedAt);
    const now = new Date();
    const daysUsed = Math.floor((now - pausedAt) / (1000 * 60 * 60 * 24));
    const daysAllocated = Math.floor((new Date(subscription.resumeDate) - pausedAt) / (1000 * 60 * 60 * 24));
    const daysUnused = Math.max(0, daysAllocated - daysUsed);

    const newEndDate = new Date(subscription.endDate);
    newEndDate.setDate(newEndDate.getDate() - daysUnused);

    const updated = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'ACTIVE', pausedAt: null, resumeDate: null, endDate: newEndDate },
      include: { plan: true }
    });

    res.json({
      message: 'Subscription resumed',
      subscription: {
        id: updated.id,
        status: updated.status,
        endDate: updated.endDate,
        plan: { name: updated.plan.name }
      }
    });
  } catch (error) {
    next(error);
  }
};

const getSubscriptionHealth = async (req, res, next) => {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: { userId: req.user.id, status: { in: ['ACTIVE', 'PAUSED'] } },
      include: { plan: true },
      orderBy: { createdAt: 'desc' }
    });

    if (!subscription) {
      return res.json({ health: null });
    }

    const now = new Date();
    const daysRemaining = Math.max(0, Math.ceil((new Date(subscription.endDate) - now) / (1000 * 60 * 60 * 24)));
    const totalDays = subscription.plan.duration === 'MONTHLY' ? 30 : subscription.plan.duration === 'QUARTERLY' ? 90 : 365;
    const percentUsed = Math.min(100, Math.round(((totalDays - daysRemaining) / totalDays) * 100));

    const workoutsThisMonth = await prisma.workoutLog.count({
      where: {
        userId: req.user.id,
        logDate: { gte: new Date(now.getFullYear(), now.getMonth(), 1) }
      }
    });

    const classesThisMonth = await prisma.classBooking.count({
      where: {
        userId: req.user.id,
        status: 'CONFIRMED',
        gymClass: { schedule: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } }
      }
    });

    res.json({
      health: {
        daysRemaining,
        percentUsed,
        workoutsThisMonth,
        classesThisMonth,
        status: subscription.status,
        isPaused: subscription.status === 'PAUSED',
        pausedAt: subscription.pausedAt,
        resumeDate: subscription.resumeDate,
        warningLevel: daysRemaining <= 7 ? 'critical' : daysRemaining <= 14 ? 'warning' : 'good'
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMySubscription, getSubscriptionHistory, purchaseSubscription, renewSubscription, cancelSubscription,
  pauseSubscription, resumeSubscription, getSubscriptionHealth
};
