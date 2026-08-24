const prisma = require('../config/prisma');

const getAllPlans = async (req, res, next) => {
  try {
    const { includeInactive } = req.query;

    const where = includeInactive === 'true' ? {} : { isActive: true };

    const plans = await prisma.plan.findMany({ where, orderBy: { price: 'asc' } });

    res.json({
      plans: plans.map(plan => ({
        id: plan.id,
        name: plan.name,
        duration: plan.duration,
        price: plan.price,
        currency: plan.currency || 'USD',
        features: plan.features,
        isActive: plan.isActive,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt
      }))
    });
  } catch (error) {
    next(error);
  }
};

const getPlanById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const plan = await prisma.plan.findUnique({ where: { id } });

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    res.json({
      plan: { id: plan.id, name: plan.name, duration: plan.duration, price: plan.price, currency: plan.currency || 'USD', features: plan.features, isActive: plan.isActive, createdAt: plan.createdAt, updatedAt: plan.updatedAt }
    });
  } catch (error) {
    next(error);
  }
};

const createPlan = async (req, res, next) => {
  try {
    const { name, duration, price, currency, features, isActive } = req.body;

    const plan = await prisma.plan.create({
      data: {
        name,
        duration,
        price: parseFloat(price),
        currency: currency ? currency.toUpperCase() : 'USD',
        features: features || [],
        isActive: isActive !== undefined ? isActive : true
      }
    });

    res.status(201).json({
      message: 'Plan created successfully',
      plan: { id: plan.id, name: plan.name, duration: plan.duration, price: plan.price, currency: plan.currency, features: plan.features, isActive: plan.isActive, createdAt: plan.createdAt, updatedAt: plan.updatedAt }
    });
  } catch (error) {
    next(error);
  }
};

const updatePlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, duration, price, currency, features, isActive } = req.body;

    const existing = await prisma.plan.findUnique({ where: { id } });

    if (!existing) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const data = {};
    if (name) data.name = name;
    if (duration) data.duration = duration;
    if (price) data.price = parseFloat(price);
    if (currency) data.currency = currency.toUpperCase();
    if (features) data.features = features;
    if (isActive !== undefined) data.isActive = isActive;

    const plan = await prisma.plan.update({ where: { id }, data });

    res.json({
      message: 'Plan updated successfully',
      plan: { id: plan.id, name: plan.name, duration: plan.duration, price: plan.price, currency: plan.currency, features: plan.features, isActive: plan.isActive, createdAt: plan.createdAt, updatedAt: plan.updatedAt }
    });
  } catch (error) {
    next(error);
  }
};

const deletePlan = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await prisma.plan.findUnique({ where: { id } });

    if (!existing) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    await prisma.plan.update({ where: { id }, data: { isActive: false } });

    res.json({ message: 'Plan deactivated successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAllPlans, getPlanById, createPlan, updatePlan, deletePlan };
