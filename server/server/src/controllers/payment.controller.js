const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const prisma = require('../config/prisma');

// KNOWN BUGS
// Bug 1 — Webhook is not idempotent: Stripe can deliver the same event more than once.
//   handlePaymentSuccess() uses updateMany() with no guard, so a duplicate
//   payment_intent.succeeded delivery will run the update again without error. While this
//   particular update is safe to repeat, any future logic added here (e.g. sending an email,
//   crediting a referral) could fire twice. The handler should record processed event IDs and
//   skip duplicates.
//
// Bug 2 — FIXED: createPaymentIntent() now creates the DB record first (with
//   stripePaymentIntentId: null), then calls stripe.paymentIntents.create(), then updates
//   the DB record with the returned Stripe ID. This ensures a local audit trail exists even
//   if the Stripe call fails.
//
// Bug 3 — Currency fallback to USD: Currency is now plan-driven (line 35: `const currency = plan.currency || 'USD'`).
//   However, if a plan is missing the currency field, the system silently defaults to USD. This may mismatch
//   the intended currency for international plans. Consider: (a) enforcing a currency value on plan creation,
//   or (b) setting a configurable global default instead of 'USD'.

const createPaymentIntent = async (req, res, next) => {
  try {
    const { planId } = req.body;

    const plan = await prisma.plan.findUnique({ where: { id: planId } });

    if (!plan || !plan.isActive) {
      return res.status(404).json({ error: 'Plan not found or inactive' });
    }

    const currency = plan.currency || 'USD';

    const payment = await prisma.payment.create({
      data: {
        userId: req.user.id,
        amount: plan.price,
        currency: currency,
        status: 'PENDING',
        stripePaymentIntentId: null,
        paymentMethod: 'card'
      }
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(plan.price * 100),
      currency: currency.toLowerCase(),
      metadata: { userId: req.user.id, planId: plan.id, planName: plan.name, paymentId: payment.id }
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { stripePaymentIntentId: paymentIntent.id }
    });

    res.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id });
  } catch (error) {
    next(error);
  }
};

const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const existingEvent = await prisma.processedEvent.findUnique({
      where: { eventId: event.id }
    });

    if (existingEvent) {
      console.log(`Event ${event.id} already processed, skipping`);
      return res.json({ received: true });
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    await prisma.processedEvent.create({
      data: { eventId: event.id, eventType: event.type }
    });

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
};

const handlePaymentSuccess = async (paymentIntent) => {
  await prisma.payment.updateMany({
    where: { stripePaymentIntentId: paymentIntent.id },
    data: { status: 'COMPLETED' }
  });
  console.log(`Payment ${paymentIntent.id} completed for user ${paymentIntent.metadata.userId}`);
};

const handlePaymentFailed = async (paymentIntent) => {
  await prisma.payment.updateMany({
    where: { stripePaymentIntentId: paymentIntent.id },
    data: { status: 'FAILED' }
  });
  console.log(`Payment ${paymentIntent.id} failed`);
};

const getPaymentHistory = async (req, res, next) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { userId: req.user.id },
      include: {
        subscription: {
          include: { plan: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      payments: payments.map(payment => {
        let subscriptionData = null;

        if (payment.subscription) {
          const sub = payment.subscription;
          subscriptionData = {
            id: sub.id,
            userId: sub.userId,
            planId: sub.planId,
            status: sub.status,
            startDate: sub.startDate,
            endDate: sub.endDate,
            createdAt: sub.createdAt,
            plan: { id: sub.plan.id, name: sub.plan.name, duration: sub.plan.duration, price: sub.plan.price, features: sub.plan.features }
          };
        }

        return {
          id: payment.id,
          userId: payment.userId,
          subscriptionId: payment.subscriptionId,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          stripePaymentIntentId: payment.stripePaymentIntentId,
          paymentMethod: payment.paymentMethod,
          createdAt: payment.createdAt,
          subscription: subscriptionData
        };
      })
    });
  } catch (error) {
    next(error);
  }
};

const getPaymentSummary = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [total, byStatus, recentPayments] = await Promise.all([
      prisma.payment.aggregate({
        where: { userId, status: 'COMPLETED' },
        _sum: { amount: true },
        _count: { id: true }
      }),
      prisma.payment.groupBy({
        by: ['status'],
        where: { userId },
        _count: { status: true },
        _sum: { amount: true }
      }),
      prisma.payment.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { id: true, amount: true, currency: true, status: true, createdAt: true, paymentMethod: true }
      })
    ]);

    const statusBreakdown = Object.fromEntries(
      byStatus.map(s => [s.status, { count: s._count.status, total: s._sum.amount || 0 }])
    );

    res.json({
      summary: {
        totalSpent: total._sum.amount || 0,
        totalPayments: total._count.id,
        statusBreakdown,
        recentPayments
      }
    });
  } catch (error) {
    next(error);
  }
};

const getPaymentReceipt = async (req, res, next) => {
  try {
    const { id } = req.params;

    const payment = await prisma.payment.findFirst({
      where: { id, userId: req.user.id },
      include: {
        subscription: { include: { plan: true } },
        user: { select: { name: true, email: true } }
      }
    });

    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    const receipt = {
      receiptNumber: `RCP-${payment.id.slice(-8).toUpperCase()}`,
      issuedAt: payment.createdAt,
      customer: payment.user,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      paymentMethod: payment.paymentMethod,
      stripePaymentIntentId: payment.stripePaymentIntentId,
      plan: payment.subscription?.plan ? {
        name: payment.subscription.plan.name,
        duration: payment.subscription.plan.duration,
        startDate: payment.subscription.startDate,
        endDate: payment.subscription.endDate
      } : null
    };

    res.json({ receipt });
  } catch (error) {
    next(error);
  }
};

const getAdminPaymentAnalytics = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const where = { status: 'COMPLETED' };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [revenue, byMethod, failureRate] = await Promise.all([
      prisma.payment.aggregate({ where, _sum: { amount: true }, _count: { id: true } }),
      prisma.payment.groupBy({
        by: ['paymentMethod'],
        where,
        _count: { paymentMethod: true },
        _sum: { amount: true }
      }),
      prisma.payment.groupBy({
        by: ['status'],
        _count: { status: true }
      })
    ]);

    const statusCounts = Object.fromEntries(failureRate.map(s => [s.status, s._count.status]));
    const totalAttempts = Object.values(statusCounts).reduce((a, b) => a + b, 0);

    res.json({
      analytics: {
        totalRevenue: revenue._sum.amount || 0,
        totalTransactions: revenue._count.id,
        byMethod,
        failureRate: totalAttempts > 0 ? ((statusCounts.FAILED || 0) / totalAttempts * 100).toFixed(1) : '0.0',
        statusBreakdown: statusCounts
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createPaymentIntent, handleWebhook, getPaymentHistory, getPaymentSummary, getPaymentReceipt, getAdminPaymentAnalytics };
