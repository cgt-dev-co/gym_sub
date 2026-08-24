const cron = require('node-cron');
const prisma = require('../config/prisma');

const CRON_TIMEZONE = process.env.CRON_TIMEZONE || 'UTC';

// ── Subscription expiry warnings (daily at 8 AM) ─────────────────────────────
const subscriptionExpiryJob = cron.schedule('0 8 * * *', async () => {
  try {
    const warningThresholds = [7, 3, 1];

    for (const days of warningThresholds) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + days);
      const dayStart = new Date(targetDate.setHours(0, 0, 0, 0));
      const dayEnd = new Date(targetDate.setHours(23, 59, 59, 999));

      const expiring = await prisma.subscription.findMany({
        where: {
          status: 'ACTIVE',
          endDate: { gte: dayStart, lte: dayEnd }
        },
        include: { user: true, plan: true }
      });

      for (const sub of expiring) {
        await prisma.notification.create({
          data: {
            userId: sub.userId,
            title: `Subscription Expiring in ${days} Day${days > 1 ? 's' : ''}`,
            message: `Your ${sub.plan.name} plan expires on ${new Date(sub.endDate).toLocaleDateString()}. Renew now to keep your access.`,
            type: days === 1 ? 'WARNING' : 'INFO'
          }
        });
      }

      if (expiring.length > 0) {
        console.log(`[cronJobs] Sent expiry warnings to ${expiring.length} users (${days}-day threshold)`);
      }
    }
  } catch (error) {
    console.error('[cronJobs] Error in subscriptionExpiryJob:', error);
  }
}, { scheduled: true, timezone: CRON_TIMEZONE });

// ── Expire subscriptions (daily at midnight) ──────────────────────────────────
const subscriptionExpirationJob = cron.schedule('0 0 * * *', async () => {
  try {
    const now = new Date();

    const { count } = await prisma.subscription.updateMany({
      where: { status: 'ACTIVE', endDate: { lt: now } },
      data: { status: 'EXPIRED' }
    });

    if (count > 0) {
      console.log(`[cronJobs] Expired ${count} subscriptions`);
    }
  } catch (error) {
    console.error('[cronJobs] Error in subscriptionExpirationJob:', error);
  }
}, { scheduled: true, timezone: CRON_TIMEZONE });

// ── Auto-resume paused subscriptions (every hour) ─────────────────────────────
const autoResumeJob = cron.schedule('0 * * * *', async () => {
  try {
    const now = new Date();

    const toResume = await prisma.subscription.findMany({
      where: { status: 'PAUSED', resumeDate: { lte: now } },
      include: { user: true, plan: true }
    });

    for (const sub of toResume) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'ACTIVE', pausedAt: null, resumeDate: null }
      });

      await prisma.notification.create({
        data: {
          userId: sub.userId,
          title: 'Subscription Resumed',
          message: `Your ${sub.plan.name} subscription has been automatically resumed. Welcome back!`,
          type: 'SUCCESS'
        }
      });
    }

    if (toResume.length > 0) {
      console.log(`[cronJobs] Auto-resumed ${toResume.length} subscriptions`);
    }
  } catch (error) {
    console.error('[cronJobs] Error in autoResumeJob:', error);
  }
}, { scheduled: true, timezone: CRON_TIMEZONE });

// ── Weekly activity summary (every Monday at 9 AM) ───────────────────────────
const weeklyActivitySummaryJob = cron.schedule('0 9 * * 1', async () => {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const users = await prisma.user.findMany({
      where: { role: 'USER' },
      select: { id: true, name: true }
    });

    let notified = 0;

    for (const user of users) {
      const [workouts, classes] = await Promise.all([
        prisma.workoutLog.count({ where: { userId: user.id, logDate: { gte: oneWeekAgo } } }),
        prisma.classBooking.count({ where: { userId: user.id, status: 'CONFIRMED', createdAt: { gte: oneWeekAgo } } })
      ]);

      if (workouts === 0 && classes === 0) {
        await prisma.notification.create({
          data: {
            userId: user.id,
            title: 'We Miss You!',
            message: `You haven't logged any workouts or attended any classes this week, ${user.name}. Book a class or log a workout to keep your streak alive!`,
            type: 'INFO'
          }
        });
        notified++;
      } else {
        await prisma.notification.create({
          data: {
            userId: user.id,
            title: 'Weekly Summary',
            message: `Great week, ${user.name}! You completed ${workouts} workout${workouts !== 1 ? 's' : ''} and attended ${classes} class${classes !== 1 ? 'es' : ''} this week. Keep it up!`,
            type: 'SUCCESS'
          }
        });
        notified++;
      }
    }

    console.log(`[cronJobs] Sent weekly summaries to ${notified} users`);
  } catch (error) {
    console.error('[cronJobs] Error in weeklyActivitySummaryJob:', error);
  }
}, { scheduled: true, timezone: CRON_TIMEZONE });

// ── Promote waitlisted users when a booking is cancelled (runs every 5 min) ──
const waitlistPromotionJob = cron.schedule('*/5 * * * *', async () => {
  try {
    const classes = await prisma.gymClass.findMany({
      where: { isActive: true, schedule: { gte: new Date() } },
      include: {
        _count: { select: { bookings: { where: { status: 'CONFIRMED' } } } }
      }
    });

    for (const gymClass of classes) {
      const spotsLeft = gymClass.capacity - gymClass._count.bookings;
      if (spotsLeft <= 0) continue;

      const waitlisted = await prisma.classBooking.findMany({
        where: { classId: gymClass.id, status: 'WAITLISTED' },
        orderBy: { waitlistPosition: 'asc' },
        take: spotsLeft,
        include: { user: { select: { id: true, name: true } } }
      });

      for (const booking of waitlisted) {
        await prisma.classBooking.update({
          where: { id: booking.id },
          data: { status: 'CONFIRMED', waitlistPosition: null }
        });

        await prisma.notification.create({
          data: {
            userId: booking.userId,
            title: 'Spot Available!',
            message: `A spot opened up in "${gymClass.name}" on ${new Date(gymClass.schedule).toLocaleString()}. You've been automatically confirmed!`,
            type: 'SUCCESS'
          }
        });
      }

      if (waitlisted.length > 0) {
        console.log(`[cronJobs] Promoted ${waitlisted.length} users from waitlist for class ${gymClass.id}`);
      }
    }
  } catch (error) {
    console.error('[cronJobs] Error in waitlistPromotionJob:', error);
  }
}, { scheduled: true, timezone: CRON_TIMEZONE });

const startCronJobs = () => {
  console.log('Starting cron jobs...');
  subscriptionExpiryJob.start();
  subscriptionExpirationJob.start();
  autoResumeJob.start();
  weeklyActivitySummaryJob.start();
  waitlistPromotionJob.start();
  console.log('Cron jobs initialized: expiry warnings, expiration, auto-resume, weekly summaries, waitlist promotion');
};

const stopCronJobs = () => {
  console.log('Stopping cron jobs...');
  subscriptionExpiryJob.stop();
  subscriptionExpirationJob.stop();
  autoResumeJob.stop();
  weeklyActivitySummaryJob.stop();
  waitlistPromotionJob.stop();
};

module.exports = { startCronJobs, stopCronJobs };
