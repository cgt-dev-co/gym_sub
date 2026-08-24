const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { LRUCache } = require('lru-cache');

// KNOWN BUGS
// Bug 1 — In-memory user cache never invalidated on role change: if an admin downgrades a
//   user's role in the database, getUserWithCache() will continue returning the stale cached
//   role for up to 5 minutes. Privileged endpoints can still be accessed during the TTL
//   window. Cache entries must be invalidated whenever a user record is updated.
//
// Bug 2 — FIXED: userCache is now an LRUCache (max 10,000 entries, 5-minute TTL).
//   LRU eviction automatically removes the least-recently-used entry when the cap is
//   reached; expired entries are never returned and are purged lazily on access.
//
// Bug 3 — isTokenRevoked fails open on DB error: when the tokenBlacklist lookup throws, the
//   catch block logs the error and returns true (treats the token as revoked). This means a
//   transient DB outage blocks ALL authenticated requests, causing a denial-of-service rather
//   than a graceful degradation. The failure policy should be reviewed for the specific threat
//   model of this application.

// Cache Invalidation Contract:
// ────────────────────────────────────────────────────────────────────────────
// getUserWithCache() maintains an in-memory cache with a 5-minute TTL to
// reduce database queries. However, this introduces a risk: if a user record
// is modified (e.g., role downgraded), the cache is stale until natural
// expiration.
//
// ANY endpoint or service that modifies a user record MUST call
// clearUserCache(userId) immediately after the update to invalidate the
// cache entry. This ensures that subsequent authenticate() calls fetch
// the fresh user data from the database.
//
// Failure to invalidate the cache can allow a demoted user to retain their
// old privileges (e.g., ADMIN role) for up to 5 minutes.
//
// Common update patterns:
// - After prisma.user.update({ where: { id }, data: {...} }), call clearUserCache(id)
// - After any role/permission change, call clearUserCache(id)
// - After email/password updates, consider revoking active tokens as well
// ────────────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000;

// In-memory LRU cache for user data: max 10,000 entries, 5-minute TTL.
// Least-recently-used entries are evicted when the cap is reached; expired
// entries are never returned. Exported as _userCache for testing only.
const userCache = new LRUCache({
  max: 10000,
  ttl: CACHE_TTL_MS,
  updateAgeOnGet: true
});

const getUserWithCache = async (userId) => {
  const cached = userCache.get(userId);
  if (cached) {
    return cached;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user) {
    userCache.set(userId, user);
  }
  return user;
};

const clearUserCache = (userId) => {
  userCache.delete(userId);
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
    // Log the error and let it propagate; the authenticate() middleware will catch it
    // and return 500. Failing closed (returning true) would turn transient DB outages
    // into denial-of-service for all authenticated users. Clients can distinguish:
    // - 401: token is invalid/revoked
    // - 500: service unavailable (DB error)
    console.error('Failed to check token revocation:', error);
    throw error;
  }
};

const cleanupExpiredTokens = async (timeoutMs = 30000) => {
  try {
    const cleanupPromise = prisma.tokenBlacklist.deleteMany({
      where: { expiresAt: { lt: new Date() } }
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Token cleanup timed out')), timeoutMs)
    );

    const result = await Promise.race([cleanupPromise, timeoutPromise]);
    console.log(`Cleaned up ${result.count} expired blacklist entries`);
    return { success: true, count: result.count };
  } catch (error) {
    const isTimeout = error.message.includes('timed out');
    const level = isTimeout ? 'warn' : 'error';
    console[level](`Token cleanup failed (${isTimeout ? 'timeout' : 'error'}):`, error.message);
    return { success: false, reason: isTimeout ? 'timeout' : 'error', error };
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

module.exports = { authenticate, isAdmin, revokeToken, isTokenRevoked, getUserWithCache, clearUserCache, cleanupExpiredTokens, _userCache: userCache };
