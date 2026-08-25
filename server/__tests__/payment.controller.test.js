jest.mock('../server/src/config/prisma', () => ({
  plan: { findUnique: jest.fn() },
  payment: { create: jest.fn(), update: jest.fn() }
}));

jest.mock('stripe', () => {
  const mockCreate = jest.fn();
  const mockStripe = jest.fn(() => ({ paymentIntents: { create: mockCreate } }));
  mockStripe.__mockCreate = mockCreate;
  return mockStripe;
});

const { createPaymentIntent, handlePaymentSuccess, handlePaymentFailed } = require('../server/src/controllers/payment.controller');
const prisma = require('../server/src/config/prisma');
const Stripe = require('stripe');
const mockPaymentIntentsCreate = Stripe.__mockCreate;

describe('createPaymentIntent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create payment record in DB before calling Stripe', async () => {
    const mockReq = { body: { planId: 'plan123' }, user: { id: 'user123' } };
    const mockRes = { json: jest.fn().mockReturnThis(), status: jest.fn().mockReturnThis() };
    const mockNext = jest.fn();

    prisma.plan.findUnique.mockResolvedValueOnce({
      id: 'plan123', name: 'Premium', price: 99.99, currency: 'USD', isActive: true
    });

    prisma.payment.create.mockResolvedValueOnce({ id: 'payment123', stripePaymentIntentId: null });
    mockPaymentIntentsCreate.mockResolvedValueOnce({ id: 'pi_123', client_secret: 'pi_123_secret' });
    prisma.payment.update.mockResolvedValueOnce({ id: 'payment123', stripePaymentIntentId: 'pi_123' });

    await createPaymentIntent(mockReq, mockRes, mockNext);

    // Verify DB create was called before Stripe
    const dbCreateOrder = prisma.payment.create.mock.invocationCallOrder[0];
    const stripeCreateOrder = mockPaymentIntentsCreate.mock.invocationCallOrder[0];
    expect(dbCreateOrder).toBeLessThan(stripeCreateOrder);

    expect(prisma.payment.create).toHaveBeenCalledWith({
      data: {
        userId: 'user123',
        amount: 99.99,
        currency: 'USD',
        status: 'PENDING',
        stripePaymentIntentId: null,
        paymentMethod: 'card'
      }
    });

    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 9999,
        currency: 'usd',
        metadata: expect.objectContaining({ paymentId: 'payment123' })
      })
    );

    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'payment123' },
      data: { stripePaymentIntentId: 'pi_123' }
    });

    expect(mockRes.json).toHaveBeenCalledWith({
      clientSecret: 'pi_123_secret',
      paymentIntentId: 'pi_123'
    });
  });

  it('should use EUR currency from plan', async () => {
    const mockReq = { body: { planId: 'plan_eur' }, user: { id: 'user456' } };
    const mockRes = { json: jest.fn().mockReturnThis(), status: jest.fn().mockReturnThis() };
    const mockNext = jest.fn();

    prisma.plan.findUnique.mockResolvedValueOnce({
      id: 'plan_eur', name: 'Premium EUR', price: 79.99, currency: 'EUR', isActive: true
    });

    prisma.payment.create.mockResolvedValueOnce({ id: 'payment456', stripePaymentIntentId: null });
    mockPaymentIntentsCreate.mockResolvedValueOnce({ id: 'pi_456', client_secret: 'pi_456_secret' });
    prisma.payment.update.mockResolvedValueOnce({ id: 'payment456', stripePaymentIntentId: 'pi_456' });

    await createPaymentIntent(mockReq, mockRes, mockNext);

    expect(prisma.payment.create).toHaveBeenCalledWith({
      data: {
        userId: 'user456',
        amount: 79.99,
        currency: 'EUR',
        status: 'PENDING',
        stripePaymentIntentId: null,
        paymentMethod: 'card'
      }
    });

    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 7999,
        currency: 'eur',
        metadata: expect.objectContaining({ paymentId: 'payment456' })
      })
    );
  });

  it('should fall back to USD when plan has no currency field', async () => {
    const mockReq = { body: { planId: 'plan_legacy' }, user: { id: 'user789' } };
    const mockRes = { json: jest.fn().mockReturnThis(), status: jest.fn().mockReturnThis() };
    const mockNext = jest.fn();

    prisma.plan.findUnique.mockResolvedValueOnce({
      id: 'plan_legacy', name: 'Legacy', price: 49.99, currency: null, isActive: true
    });

    prisma.payment.create.mockResolvedValueOnce({ id: 'payment789' });
    mockPaymentIntentsCreate.mockResolvedValueOnce({ id: 'pi_789', client_secret: 'pi_789_secret' });
    prisma.payment.update.mockResolvedValueOnce({ id: 'payment789', stripePaymentIntentId: 'pi_789' });

    await createPaymentIntent(mockReq, mockRes, mockNext);

    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currency: 'USD' }) })
    );
    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'usd' })
    );
  });

  it('should fail safely if Stripe call fails after DB write', async () => {
    const mockReq = { body: { planId: 'plan123' }, user: { id: 'user123' } };
    const mockRes = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    const mockNext = jest.fn();

    prisma.plan.findUnique.mockResolvedValueOnce({
      id: 'plan123', name: 'Premium', price: 99.99, currency: 'USD', isActive: true
    });

    prisma.payment.create.mockResolvedValueOnce({ id: 'payment123' });
    mockPaymentIntentsCreate.mockRejectedValueOnce(new Error('Stripe connection failed'));

    await createPaymentIntent(mockReq, mockRes, mockNext);

    expect(prisma.payment.create).toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('handlePaymentSuccess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw an error if no payment record matches the stripePaymentIntentId', async () => {
    prisma.payment = { updateMany: jest.fn().mockResolvedValueOnce({ count: 0 }) };

    const paymentIntent = { id: 'pi_orphaned', metadata: { userId: 'user123' } };

    await expect(handlePaymentSuccess(paymentIntent)).rejects.toThrow(
      `No payment found with stripePaymentIntentId pi_orphaned`
    );
  });

  it('should succeed if updateMany returns count > 0', async () => {
    prisma.payment = { updateMany: jest.fn().mockResolvedValueOnce({ count: 1 }) };

    const paymentIntent = { id: 'pi_valid', metadata: { userId: 'user123' } };
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    await handlePaymentSuccess(paymentIntent);

    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { stripePaymentIntentId: 'pi_valid' },
      data: { status: 'COMPLETED' }
    });

    expect(consoleSpy).toHaveBeenCalledWith('Payment pi_valid completed for user user123');
    consoleSpy.mockRestore();
  });
});

describe('handlePaymentFailed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw an error if no payment record matches the stripePaymentIntentId', async () => {
    prisma.payment = { updateMany: jest.fn().mockResolvedValueOnce({ count: 0 }) };

    const paymentIntent = { id: 'pi_orphaned', metadata: { userId: 'user123' } };

    await expect(handlePaymentFailed(paymentIntent)).rejects.toThrow(
      `No payment found with stripePaymentIntentId pi_orphaned`
    );
  });

  it('should succeed if updateMany returns count > 0', async () => {
    prisma.payment = { updateMany: jest.fn().mockResolvedValueOnce({ count: 1 }) };

    const paymentIntent = { id: 'pi_valid', metadata: { userId: 'user123' } };
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    await handlePaymentFailed(paymentIntent);

    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { stripePaymentIntentId: 'pi_valid' },
      data: { status: 'FAILED' }
    });

    expect(consoleSpy).toHaveBeenCalledWith('Payment pi_valid failed');
    consoleSpy.mockRestore();
  });
});
