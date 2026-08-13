const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

// In-memory cache for user data (TTL: 5 minutes)
const userCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

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

const revokeToken = async (token) => {
  try {
    const decoded = jwt.decode(token);
    const expiresAt = new Date(decoded.exp * 1000);

    await prisma.tokenBlacklist.create({
      data: { token, expiresAt }
    });
  } catch (error) {
    console.error('Failed to revoke token:', error);
    throw error;
  }
};

const isTokenRevoked = async (token) => {
  try {
    const revoked = await prisma.tokenBlacklist.findUnique({
      where: { token }
    });
    return !!revoked;
  } catch (error) {
    console.error('Failed to check token revocation:', error);
    // Fail securely: treat the token as revoked if the DB check errors
    return true;
  }
};

const cleanupExpiredTokens = async () => {
  try {
    const result = await prisma.tokenBlacklist.deleteMany({
      where: { expiresAt: { lt: new Date() } }
    });
    console.log(`Cleaned up ${result.count} expired blacklist entries`);
  } catch (error) {
    console.error('Failed to cleanup expired tokens:', error);
  }
};

const authenticate = async (req, res, next) => {
  try {
    const token = req.cookies?.jwt;

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    if (await isTokenRevoked(token)) {
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

module.exports = { authenticate, isAdmin, revokeToken, getUserWithCache, cleanupExpiredTokens };
