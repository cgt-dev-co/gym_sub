const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

// KNOWN BUGS
// Bug 1 — No rate limiting on login endpoint: the /login route has no brute-force
//   protection. An attacker can send unlimited password guesses against any email
//   address without being throttled or locked out. A rate limiter (e.g. express-rate-limit)
//   should be applied to POST /api/auth/login.
//
// Bug 2 — JWT_EXPIRES_IN falls back to undefined: if JWT_EXPIRES_IN is not set in .env,
//   jwt.sign() receives { expiresIn: undefined }, which silently creates a non-expiring
//   token. The server should validate this env var at startup alongside the other required
//   variables in validateEnvironmentVariables().
//
// Bug 3 — Tokens not invalidated on email/password change: if a user's password is updated
//   via the profile endpoint, any previously issued JWTs remain valid until they naturally
//   expire. The user's existing tokens should be revoked (added to the blacklist) whenever
//   credentials change.

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
      { expiresIn: process.env.JWT_EXPIRES_IN }
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

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
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
