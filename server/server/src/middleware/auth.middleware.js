const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

// In-memory cache for user data (TTL: 5 minutes)
const userCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

// In-memory set of blacklisted tokens
const tokenBlacklist = new Set();

const getUserWithCache = async (userId) => {
  const cached = userCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user) {
    userCache.set(userId, { data: user, timestamp: Date.now() });
  }
  return user;
};

const revokeToken = (token) => {
  tokenBlacklist.add(token);
};

const isTokenRevoked = (token) => {
  return tokenBlacklist.has(token);
};

const authenticate = async (req, res, next) => {
  try {
    const token = req.cookies?.jwt;

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    if (isTokenRevoked(token)) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await getUserWithCache(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      address: user.address,
      role: user.role
    };

    req.token = token;

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

module.exports = { authenticate, isAdmin, revokeToken, getUserWithCache };
