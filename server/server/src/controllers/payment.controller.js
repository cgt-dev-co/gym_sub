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
// Bug 2 — Orphaned PaymentIntent on DB write failure: createPaymentIntent() calls
//   stripe.paymentIntents.create() first, then prisma.payment.create(). If the DB write
//   fails (connection error, constraint violation), the PaymentIntent exists in Stripe but
//   has no corresponding local payment row. The client receives an error but holds a valid
//   clientSecret, which could allow a retry with no tracking record. The Stripe call should
//   be made after a successful DB reservation, or the DB record should be created first with
//   a PENDING placeholder.
//
// Bug 3 — Currency hardcoded to USD: the PaymentIntent is created with currency: 'usd' and
//   the local payment record stores currency: 'USD' unconditionally. If the plan price is
//   set in a different currency in the future, the Stripe charge and the DB record will be
//   mismatched. Currency should come from the plan definition or a global config value.

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

module.exports = { createPaymentIntent, handleWebhook, getPaymentHistory };
