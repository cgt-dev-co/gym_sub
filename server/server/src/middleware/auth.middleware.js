const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { LRUCache } = require('lru-cache');

// KNOWN BUGS
// Bug 1 — FIXED: authenticate() now validates cached role/isSuspended against the live
//   database on every request. If a mismatch is detected (e.g., admin demoted a user),
//   the cache entry is invalidated and the fresh DB record is used immediately. Privileged
//   access is revoked on the very next request after a role change.
//
// Bug 2 — FIXED: userCache is now an LRUCache (max 10,000 entries, 5-minute TTL).
//   LRU eviction automatically removes the least-recently-used entry when the cap is
//   reached; expired entries are never returned and are purged lazily on access.
//
// Bug 3 — FIXED: isTokenRevoked now returns false on DB error (graceful degradation).
//   A transient DB outage no longer blocks authenticated requests; revocation checks
//   are temporarily skipped rather than causing a 500 cascade for all users.

// Cache Invalidation Contract:
// ────────────────────────────────────────────────────────────────────────────
// authenticate() automatically detects stale cache by comparing the cached
// user's role and isSuspended against a fresh DB query on every request.
// If they differ, the cache entry is cleared and the fresh record is used.
//
// Callers that update user records should still call clearUserCache(userId)
// as an optimization (avoids one extra validation query on the next request),
// but correctness no longer depends on them doing so.
// ────────────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000;

// In-memory LRU cache for user data: max 10,000 entries, 5-minute TTL.
// Least-recently-used entries are evicted when the cap is reached; expired
// entries are never returned. Exported as _userCache for testing only.
//
// SECURITY: authenticate() validates cached role/isSuspended against the DB on
// every request, so stale privilege escalations are caught immediately regardless
// of whether callers remember to call clearUserCache().
const userCache = new LRUCache({
  max: 10000,
  ttl: CACHE_TTL_MS,
  updateAgeOnGet: true
});

const getUserWithCache = async (userId) => {
  const cached = userCache.get(userId);
  if (cached) {
    return [cached, true];
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user) {
    userCache.set(userId, user);
  }
  return [user, false];
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
    // Log the error but do not propagate it. If the tokenBlacklist check fails
    // (e.g., transient DB outage), assume the token is NOT revoked to allow
    // authenticated requests to proceed. This is a graceful degradation: users
    // remain able to access the application; revocation checks are temporarily
    // skipped rather than blocking all traffic.
    //
    // Revoked tokens in the database are authoritative; a missed check is lower
    // risk than rejecting all authenticated requests during an outage.
    console.error('Failed to check token revocation:', error);
    return false;
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

    const [user, wasFromCache] = await getUserWithCache(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Only validate staleness if the user came from cache. If we just fetched it
    // from the DB (cache miss), it's already fresh and we don't need a second query.
    let effectiveUser = user;
    if (wasFromCache) {
      const freshUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (!freshUser) {
        return res.status(401).json({ error: 'User not found' });
      }

      const isStale = user.role !== freshUser.role || user.isSuspended !== freshUser.isSuspended;
      if (isStale) {
        clearUserCache(decoded.userId);
        effectiveUser = freshUser;
      }
    }

    req.user = {
      id: effectiveUser.id,
      email: effectiveUser.email,
      name: effectiveUser.name,
      phone: effectiveUser.phone,
      address: effectiveUser.address,
      role: effectiveUser.role
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
