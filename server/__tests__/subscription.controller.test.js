jest.mock('../server/src/config/prisma', () => ({
  subscription: { create: jest.fn(), update: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
  plan: { findUnique: jest.fn() },
  payment: { findFirst: jest.fn(), update: jest.fn() }
}));

const {
  purchaseSubscription,
  renewSubscription,
  cancelSubscription
} = require('../server/src/controllers/subscription.controller');
const prisma = require('../server/src/config/prisma');

// ─── helpers ────────────────────────────────────────────────────────────────

const makeReq = (body = {}, userId = 'user123') => ({
  body,
  user: { id: userId }
});

const makeRes = () => {
  const res = { json: jest.fn(), status: jest.fn() };
  res.json.mockReturnThis();
  res.status.mockReturnThis();
  return res;
};

const makePlan = (duration = 'MONTHLY') => ({
  id: 'plan123', name: 'Test Plan', duration, price: 29.99, isActive: true
});

const makePayment = (overrides = {}) => ({
  id: 'payment123', status: 'COMPLETED', userId: 'user123', subscriptionId: null,
  stripePaymentIntentId: 'pi_test',
  ...overrides
});

const makeSub = (overrides = {}) => ({
  id: 'sub123', userId: 'user123', planId: 'plan123', status: 'ACTIVE',
  startDate: new Date(), endDate: new Date(),
  createdAt: new Date(), updatedAt: new Date(),
  plan: makePlan(),
  ...overrides
});

// ─── purchaseSubscription ────────────────────────────────────────────────────

describe('purchaseSubscription', () => {
  beforeEach(() => jest.clearAllMocks());

  const defaultReq = () => makeReq({ planId: 'plan123', paymentIntentId: 'pi_test' });

  it('should return 400 when paymentIntentId is missing', async () => {
    const req = makeReq({ planId: 'plan123' });
    const res = makeRes();
    await purchaseSubscription(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Payment intent ID is required' });
  });

  it('should return 404 when plan not found', async () => {
    prisma.plan.findUnique.mockResolvedValueOnce(null);
    const res = makeRes();
    await purchaseSubscription(defaultReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Plan not found or inactive' });
  });

  it('should return 404 when plan is inactive', async () => {
    prisma.plan.findUnique.mockResolvedValueOnce({ ...makePlan(), isActive: false });
    const res = makeRes();
    await purchaseSubscription(defaultReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Plan not found or inactive' });
  });

  it('should return 400 when payment not found', async () => {
    prisma.plan.findUnique.mockResolvedValueOnce(makePlan());
    prisma.payment.findFirst.mockResolvedValueOnce(null);
    const res = makeRes();
    await purchaseSubscription(defaultReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Payment not found' });
  });

  it('should return 400 when payment status is FAILED', async () => {
    prisma.plan.findUnique.mockResolvedValueOnce(makePlan());
    prisma.payment.findFirst.mockResolvedValueOnce(makePayment({ status: 'FAILED' }));
    const res = makeRes();
    await purchaseSubscription(defaultReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Payment failed' });
  });

  it('should return 402 when payment status is PENDING', async () => {
    prisma.plan.findUnique.mockResolvedValueOnce(makePlan());
    prisma.payment.findFirst.mockResolvedValueOnce(makePayment({ status: 'PENDING' }));
    const res = makeRes();
    await purchaseSubscription(defaultReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith({ error: 'Payment not completed' });
  });

  it('should return 403 when payment belongs to a different user', async () => {
    prisma.plan.findUnique.mockResolvedValueOnce(makePlan());
    prisma.payment.findFirst.mockResolvedValueOnce(makePayment({ userId: 'other-user' }));
    const res = makeRes();
    await purchaseSubscription(defaultReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Payment does not belong to this user' });
  });

  it('should return 400 when payment is already used for a subscription', async () => {
    prisma.plan.findUnique.mockResolvedValueOnce(makePlan());
    prisma.payment.findFirst.mockResolvedValueOnce(makePayment({ subscriptionId: 'existing-sub' }));
    const res = makeRes();
    await purchaseSubscription(defaultReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Payment already used for a subscription' });
  });

  it('should return 400 when user already has an active subscription', async () => {
    prisma.plan.findUnique.mockResolvedValueOnce(makePlan());
    prisma.payment.findFirst.mockResolvedValueOnce(makePayment());
    prisma.subscription.findFirst.mockResolvedValueOnce(makeSub());
    const res = makeRes();
    await purchaseSubscription(defaultReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'You already have an active subscription' });
  });

  it('should create subscription and link payment, return 201 for MONTHLY plan', async () => {
    prisma.plan.findUnique.mockResolvedValueOnce(makePlan('MONTHLY'));
    prisma.payment.findFirst.mockResolvedValueOnce(makePayment());
    prisma.subscription.findFirst.mockResolvedValueOnce(null);
    prisma.subscription.create.mockResolvedValueOnce(makeSub());
    prisma.payment.update.mockResolvedValueOnce({});

    const res = makeRes();
    await purchaseSubscription(defaultReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Subscription purchased successfully',
        subscription: expect.objectContaining({ id: 'sub123', status: 'ACTIVE' })
      })
    );
  });

  it('should link payment to the created subscription', async () => {
    prisma.plan.findUnique.mockResolvedValueOnce(makePlan('MONTHLY'));
    prisma.payment.findFirst.mockResolvedValueOnce(makePayment());
    prisma.subscription.findFirst.mockResolvedValueOnce(null);
    prisma.subscription.create.mockResolvedValueOnce(makeSub());
    prisma.payment.update.mockResolvedValueOnce({});

    await purchaseSubscription(defaultReq(), makeRes(), jest.fn());

    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'payment123' },
      data: { subscriptionId: 'sub123' }
    });
  });

  it('should call subscription.create before payment.update', async () => {
    prisma.plan.findUnique.mockResolvedValueOnce(makePlan('MONTHLY'));
    prisma.payment.findFirst.mockResolvedValueOnce(makePayment());
    prisma.subscription.findFirst.mockResolvedValueOnce(null);
    prisma.subscription.create.mockResolvedValueOnce(makeSub());
    prisma.payment.update.mockResolvedValueOnce({});

    await purchaseSubscription(defaultReq(), makeRes(), jest.fn());

    const createOrder = prisma.subscription.create.mock.invocationCallOrder[0];
    const updateOrder = prisma.payment.update.mock.invocationCallOrder[0];
    expect(createOrder).toBeLessThan(updateOrder);
  });

  it('should calculate endDate ~1 month ahead for MONTHLY plan', async () => {
    prisma.plan.findUnique.mockResolvedValueOnce(makePlan('MONTHLY'));
    prisma.payment.findFirst.mockResolvedValueOnce(makePayment());
    prisma.subscription.findFirst.mockResolvedValueOnce(null);
    prisma.subscription.create.mockImplementationOnce(async ({ data }) => ({
      ...makeSub(), startDate: data.startDate, endDate: data.endDate
    }));
    prisma.payment.update.mockResolvedValueOnce({});

    const before = new Date();
    await purchaseSubscription(defaultReq(), makeRes(), jest.fn());

    const createArgs = prisma.subscription.create.mock.calls[0][0].data;
    const diffMonths = (createArgs.endDate - createArgs.startDate) / (1000 * 60 * 60 * 24);
    // MONTHLY: ~28–31 days
    expect(diffMonths).toBeGreaterThanOrEqual(28);
    expect(diffMonths).toBeLessThanOrEqual(31);
  });

  it('should calculate endDate ~3 months ahead for QUARTERLY plan', async () => {
    prisma.plan.findUnique.mockResolvedValueOnce(makePlan('QUARTERLY'));
    prisma.payment.findFirst.mockResolvedValueOnce(makePayment());
    prisma.subscription.findFirst.mockResolvedValueOnce(null);
    prisma.subscription.create.mockImplementationOnce(async ({ data }) => ({
      ...makeSub(), startDate: data.startDate, endDate: data.endDate
    }));
    prisma.payment.update.mockResolvedValueOnce({});

    await purchaseSubscription(defaultReq(), makeRes(), jest.fn());

    const createArgs = prisma.subscription.create.mock.calls[0][0].data;
    const diffDays = (createArgs.endDate - createArgs.startDate) / (1000 * 60 * 60 * 24);
    // QUARTERLY: ~89–92 days
    expect(diffDays).toBeGreaterThanOrEqual(89);
    expect(diffDays).toBeLessThanOrEqual(92);
  });

  it('should calculate endDate ~1 year ahead for YEARLY plan', async () => {
    prisma.plan.findUnique.mockResolvedValueOnce(makePlan('YEARLY'));
    prisma.payment.findFirst.mockResolvedValueOnce(makePayment());
    prisma.subscription.findFirst.mockResolvedValueOnce(null);
    prisma.subscription.create.mockImplementationOnce(async ({ data }) => ({
      ...makeSub(), startDate: data.startDate, endDate: data.endDate
    }));
    prisma.payment.update.mockResolvedValueOnce({});

    await purchaseSubscription(defaultReq(), makeRes(), jest.fn());

    const createArgs = prisma.subscription.create.mock.calls[0][0].data;
    const diffDays = (createArgs.endDate - createArgs.startDate) / (1000 * 60 * 60 * 24);
    // YEARLY: ~365–366 days
    expect(diffDays).toBeGreaterThanOrEqual(365);
    expect(diffDays).toBeLessThanOrEqual(366);
  });

  it('should call next(error) on unexpected error', async () => {
    prisma.plan.findUnique.mockRejectedValueOnce(new Error('DB down'));
    const next = jest.fn();
    await purchaseSubscription(defaultReq(), makeRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── renewSubscription ───────────────────────────────────────────────────────

describe('renewSubscription', () => {
  beforeEach(() => jest.clearAllMocks());

  const defaultReq = () => makeReq({ subscriptionId: 'sub123', paymentIntentId: 'pi_test' });

  it('should return 400 when paymentIntentId is missing', async () => {
    const req = makeReq({ subscriptionId: 'sub123' });
    const res = makeRes();
    await renewSubscription(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Payment intent ID is required' });
  });

  it('should return 404 when subscription not found', async () => {
    prisma.subscription.findFirst.mockResolvedValueOnce(null);
    const res = makeRes();
    await renewSubscription(defaultReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Subscription not found' });
  });

  it('should return 404 when subscription belongs to a different user', async () => {
    // findFirst with userId filter returns null when user doesn't own it
    prisma.subscription.findFirst.mockResolvedValueOnce(null);
    const req = makeReq({ subscriptionId: 'sub123', paymentIntentId: 'pi_test' }, 'other-user');
    const res = makeRes();
    await renewSubscription(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should return 400 when payment not found', async () => {
    prisma.subscription.findFirst.mockResolvedValueOnce(makeSub());
    prisma.payment.findFirst.mockResolvedValueOnce(null);
    const res = makeRes();
    await renewSubscription(defaultReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Payment not found' });
  });

  it('should return 400 when payment status is FAILED', async () => {
    prisma.subscription.findFirst.mockResolvedValueOnce(makeSub());
    prisma.payment.findFirst.mockResolvedValueOnce(makePayment({ status: 'FAILED' }));
    const res = makeRes();
    await renewSubscription(defaultReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Payment failed' });
  });

  it('should return 402 when payment status is PENDING', async () => {
    prisma.subscription.findFirst.mockResolvedValueOnce(makeSub());
    prisma.payment.findFirst.mockResolvedValueOnce(makePayment({ status: 'PENDING' }));
    const res = makeRes();
    await renewSubscription(defaultReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith({ error: 'Payment not completed' });
  });

  it('should return 403 when payment belongs to a different user', async () => {
    prisma.subscription.findFirst.mockResolvedValueOnce(makeSub());
    prisma.payment.findFirst.mockResolvedValueOnce(makePayment({ userId: 'other-user' }));
    const res = makeRes();
    await renewSubscription(defaultReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Payment does not belong to this user' });
  });

  it('should return 400 when payment already used for a different subscription', async () => {
    prisma.subscription.findFirst.mockResolvedValueOnce(makeSub());
    prisma.payment.findFirst.mockResolvedValueOnce(makePayment({ subscriptionId: 'other-sub' }));
    const res = makeRes();
    await renewSubscription(defaultReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Payment already used for a different subscription' });
  });

  it('should allow renewal when payment.subscriptionId matches the same subscription', async () => {
    prisma.subscription.findFirst.mockResolvedValueOnce(makeSub());
    prisma.payment.findFirst.mockResolvedValueOnce(makePayment({ subscriptionId: 'sub123' }));
    const updatedSub = { ...makeSub(), status: 'ACTIVE' };
    prisma.subscription.update.mockResolvedValueOnce(updatedSub);

    const res = makeRes();
    await renewSubscription(defaultReq(), res, jest.fn());

    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(prisma.subscription.update).toHaveBeenCalled();
    // payment.update should NOT be called since subscriptionId is already set
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it('should update subscription to ACTIVE with new dates and return 200', async () => {
    prisma.subscription.findFirst.mockResolvedValueOnce(makeSub());
    prisma.payment.findFirst.mockResolvedValueOnce(makePayment());
    const renewedSub = makeSub({ status: 'ACTIVE' });
    prisma.subscription.update.mockResolvedValueOnce(renewedSub);
    prisma.payment.update.mockResolvedValueOnce({});

    const res = makeRes();
    await renewSubscription(defaultReq(), res, jest.fn());

    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub123' },
        data: expect.objectContaining({ status: 'ACTIVE' })
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Subscription renewed successfully',
        subscription: expect.objectContaining({ id: 'sub123', status: 'ACTIVE' })
      })
    );
  });

  it('should link payment when payment.subscriptionId is null', async () => {
    prisma.subscription.findFirst.mockResolvedValueOnce(makeSub());
    prisma.payment.findFirst.mockResolvedValueOnce(makePayment({ subscriptionId: null }));
    prisma.subscription.update.mockResolvedValueOnce(makeSub());
    prisma.payment.update.mockResolvedValueOnce({});

    await renewSubscription(defaultReq(), makeRes(), jest.fn());

    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'payment123' },
      data: { subscriptionId: 'sub123' }
    });
  });

  it('should calculate new endDate ~3 months ahead for QUARTERLY plan', async () => {
    const quarterlySub = makeSub({ plan: makePlan('QUARTERLY') });
    prisma.subscription.findFirst.mockResolvedValueOnce(quarterlySub);
    prisma.payment.findFirst.mockResolvedValueOnce(makePayment());
    prisma.subscription.update.mockImplementationOnce(async ({ data }) => ({
      ...makeSub(), startDate: data.startDate, endDate: data.endDate
    }));
    prisma.payment.update.mockResolvedValueOnce({});

    await renewSubscription(defaultReq(), makeRes(), jest.fn());

    const updateArgs = prisma.subscription.update.mock.calls[0][0].data;
    const diffDays = (updateArgs.endDate - updateArgs.startDate) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(89);
    expect(diffDays).toBeLessThanOrEqual(92);
  });

  it('should call next(error) on unexpected error', async () => {
    prisma.subscription.findFirst.mockRejectedValueOnce(new Error('DB down'));
    const next = jest.fn();
    await renewSubscription(defaultReq(), makeRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── cancelSubscription ──────────────────────────────────────────────────────

describe('cancelSubscription', () => {
  beforeEach(() => jest.clearAllMocks());

  const defaultReq = () => makeReq({ subscriptionId: 'sub123' });

  it('should return 404 when subscription not found', async () => {
    prisma.subscription.findFirst.mockResolvedValueOnce(null);
    const res = makeRes();
    await cancelSubscription(defaultReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Subscription not found' });
  });

  it('should return 404 when subscription belongs to a different user', async () => {
    // findFirst filters by userId, so no match for wrong user
    prisma.subscription.findFirst.mockResolvedValueOnce(null);
    const req = makeReq({ subscriptionId: 'sub123' }, 'other-user');
    const res = makeRes();
    await cancelSubscription(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should set subscription status to CANCELLED and return 200', async () => {
    const activeSub = makeSub({ status: 'ACTIVE' });
    const cancelledSub = { ...activeSub, status: 'CANCELLED' };
    prisma.subscription.findFirst.mockResolvedValueOnce(activeSub);
    prisma.subscription.update.mockResolvedValueOnce(cancelledSub);

    const res = makeRes();
    await cancelSubscription(defaultReq(), res, jest.fn());

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub123' },
      data: { status: 'CANCELLED' }
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Subscription cancelled successfully',
        subscription: expect.objectContaining({ id: 'sub123', status: 'CANCELLED' })
      })
    );
  });

  it('should include subscription fields in response', async () => {
    const activeSub = makeSub({ status: 'ACTIVE' });
    const cancelledSub = { ...activeSub, status: 'CANCELLED' };
    prisma.subscription.findFirst.mockResolvedValueOnce(activeSub);
    prisma.subscription.update.mockResolvedValueOnce(cancelledSub);

    const res = makeRes();
    await cancelSubscription(defaultReq(), res, jest.fn());

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription: expect.objectContaining({
          id: 'sub123',
          userId: 'user123',
          planId: 'plan123',
          status: 'CANCELLED',
          startDate: expect.any(Date),
          endDate: expect.any(Date)
        })
      })
    );
  });

  it('should call next(error) on unexpected error', async () => {
    prisma.subscription.findFirst.mockRejectedValueOnce(new Error('DB down'));
    const next = jest.fn();
    await cancelSubscription(defaultReq(), makeRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
