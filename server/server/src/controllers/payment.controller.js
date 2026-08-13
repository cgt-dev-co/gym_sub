const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const prisma = require('../config/prisma');

const createPaymentIntent = async (req, res, next) => {
  try {
    const { planId } = req.body;

    const plan = await prisma.plan.findUnique({ where: { id: planId } });

    if (!plan || !plan.isActive) {
      return res.status(404).json({ error: 'Plan not found or inactive' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(plan.price * 100),
      currency: 'usd',
      metadata: { userId: req.user.id, planId: plan.id, planName: plan.name }
    });

    await prisma.payment.create({
      data: {
        userId: req.user.id,
        amount: plan.price,
        currency: 'USD',
        status: 'PENDING',
        stripePaymentIntentId: paymentIntent.id,
        paymentMethod: 'card'
      }
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
