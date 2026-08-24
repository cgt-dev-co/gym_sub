const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { clearUserCache } = require('../middleware/auth.middleware');

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

    res.json({
      message: 'Profile updated successfully',
      user: { id: updated.id, email: updated.email, name: updated.name, phone: updated.phone, address: updated.address, role: updated.role, updatedAt: updated.updatedAt }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getProfile, updateProfile };
