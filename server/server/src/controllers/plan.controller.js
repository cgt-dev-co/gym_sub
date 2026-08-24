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

const comparePlans = async (req, res, next) => {
  try {
    const { ids } = req.query;
    if (!ids) return res.status(400).json({ error: 'Provide plan IDs as ?ids=a,b,c' });

    const planIds = ids.split(',').map(id => id.trim()).filter(Boolean);
    if (planIds.length < 2 || planIds.length > 4) {
      return res.status(400).json({ error: 'Compare 2–4 plans at a time' });
    }

    const plans = await prisma.plan.findMany({ where: { id: { in: planIds } } });

    const planMap = Object.fromEntries(plans.map(p => [p.id, p]));
    const ordered = planIds.map(id => planMap[id]).filter(Boolean);

    const allFeatures = [...new Set(ordered.flatMap(p => p.features || []))];

    const comparison = ordered.map(plan => ({
      id: plan.id,
      name: plan.name,
      price: plan.price,
      duration: plan.duration,
      currency: plan.currency || 'USD',
      isActive: plan.isActive,
      features: plan.features || [],
      featureMatrix: Object.fromEntries(allFeatures.map(f => [f, (plan.features || []).includes(f)]))
    }));

    res.json({ comparison, allFeatures });
  } catch (error) {
    next(error);
  }
};

const getPlanStats = async (req, res, next) => {
  try {
    const { id } = req.params;

    const plan = await prisma.plan.findUnique({ where: { id } });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    const [totalSubscriptions, activeSubscriptions, totalRevenue] = await Promise.all([
      prisma.subscription.count({ where: { planId: id } }),
      prisma.subscription.count({ where: { planId: id, status: 'ACTIVE' } }),
      prisma.payment.aggregate({
        where: { status: 'COMPLETED', subscription: { planId: id } },
        _sum: { amount: true }
      })
    ]);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentSubscriptions = await prisma.subscription.count({
      where: { planId: id, createdAt: { gte: thirtyDaysAgo } }
    });

    res.json({
      plan: { id: plan.id, name: plan.name, price: plan.price, duration: plan.duration },
      stats: { totalSubscriptions, activeSubscriptions, recentSubscriptions, totalRevenue: totalRevenue._sum.amount || 0 }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAllPlans, getPlanById, createPlan, updatePlan, deletePlan, comparePlans, getPlanStats };
