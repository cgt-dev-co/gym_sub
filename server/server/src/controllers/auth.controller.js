const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

// KNOWN BUGS
// Bug 1 — FIXED: Rate limiting added to POST /api/auth/login via loginLimiter and
//   POST /api/auth/register via registerLimiter in auth.routes.js (express-rate-limit).
//
// Bug 2 — FIXED: JWT_EXPIRES_IN is now validated at startup in validateEnvironmentVariables()
//   in index.js. The sign() calls below use a '7d' fallback for safety in tests/dev.
//
// Bug 3 — FIXED: updateProfile() in user.controller.js revokes the current JWT when
//   a password change is detected, invalidating all existing sessions for the user.

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000
};

const register = async (req, res, next) => {
  try {
    const { email, password, name, phone, address } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name, phone, address, role: 'USER' }
    });

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.cookie('jwt', token, COOKIE_OPTIONS);
    res.status(201).json({
      message: 'User registered successfully',
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone, address: user.address, role: user.role, createdAt: user.createdAt }
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.loginAttempts >= 5 && user.lockUntil && new Date(user.lockUntil) > new Date()) {
      return res.status(429).json({
        error: 'Account temporarily locked due to multiple failed login attempts. Please try again later.'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      const loginAttempts = (user.loginAttempts || 0) + 1;
      const lockUntil = loginAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await prisma.user.update({
        where: { id: user.id },
        data: { loginAttempts, lockUntil }
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { loginAttempts: 0, lockUntil: null }
    });

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.cookie('jwt', token, COOKIE_OPTIONS);
    res.json({
      message: 'Login successful',
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone, address: user.address, role: user.role, createdAt: user.createdAt }
    });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const subscriptions = await prisma.subscription.findMany({
      where: { userId: user.id, status: 'ACTIVE' },
      include: { plan: true },
      take: 1,
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
          plan: { id: sub.plan.id, name: sub.plan.name, duration: sub.plan.duration, price: sub.plan.price, features: sub.plan.features }
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    if (!req.token) {
      return res.status(400).json({ error: 'No token provided' });
    }

    const { revokeToken } = require('../middleware/auth.middleware');
    await revokeToken(req.token);

    res.clearCookie('jwt', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe, logout };
