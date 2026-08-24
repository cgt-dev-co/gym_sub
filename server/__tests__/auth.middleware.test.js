jest.mock('../server/src/config/prisma', () => ({
  user: { findUnique: jest.fn() },
  tokenBlacklist: { findUnique: jest.fn(), deleteMany: jest.fn() }
}));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
  decode: jest.fn()
}));

const { getUserWithCache, clearUserCache, isTokenRevoked, authenticate, _userCache } = require('../server/src/middleware/auth.middleware');
const prisma = require('../server/src/config/prisma');
const jwt = require('jsonwebtoken');

describe('getUserWithCache and clearUserCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearUserCache('user-1');
  });

  it('should return cached data on subsequent calls within TTL without hitting the DB again', async () => {
    const mockUser = { id: 'user-1', name: 'Alice', role: 'ADMIN' };
    prisma.user.findUnique.mockResolvedValue(mockUser);

    const first = await getUserWithCache('user-1');
    const second = await getUserWithCache('user-1');

    expect(first).toEqual(mockUser);
    expect(second).toEqual(mockUser);
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
  });

  it('should invalidate cache entry so next getUserWithCache call fetches fresh data from DB', async () => {
    const staleUser = { id: 'user-1', name: 'Alice', role: 'ADMIN' };
    const freshUser = { id: 'user-1', name: 'Alice', role: 'USER' };

    prisma.user.findUnique
      .mockResolvedValueOnce(staleUser)
      .mockResolvedValueOnce(freshUser);

    const cached = await getUserWithCache('user-1');
    expect(cached.role).toBe('ADMIN');
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);

    clearUserCache('user-1');

    const fresh = await getUserWithCache('user-1');
    expect(fresh.role).toBe('USER');
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
  });

  it('should be a no-op when clearing a userId that is not cached', () => {
    expect(() => clearUserCache('unknown-user')).not.toThrow();
  });

  it('should return fresh user data after cache invalidation when role is downgraded', async () => {
    const adminUser = { id: 'user-1', name: 'Bob', role: 'ADMIN', email: 'bob@example.com' };
    const demotedUser = { id: 'user-1', name: 'Bob', role: 'USER', email: 'bob@example.com' };

    prisma.user.findUnique
      .mockResolvedValueOnce(adminUser)   // First call: cached ADMIN
      .mockResolvedValueOnce(demotedUser); // After clear: fresh USER

    // Simulate initial authentication with ADMIN role
    const cachedResult = await getUserWithCache('user-1');
    expect(cachedResult.role).toBe('ADMIN');

    // Simulate admin downgrading the user's role in the database
    clearUserCache('user-1');

    // Next call should fetch fresh data from DB (USER role)
    const freshResult = await getUserWithCache('user-1');
    expect(freshResult.role).toBe('USER');
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
  });
});

describe('LRU cache configuration and eviction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _userCache.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should have max size of 10,000 and TTL of 5 minutes', () => {
    expect(_userCache.max).toBe(10000);
    expect(_userCache.ttl).toBe(5 * 60 * 1000);
  });

  it('should evict the oldest entry when max size is exceeded', () => {
    for (let i = 0; i < 10001; i++) {
      _userCache.set(`overflow-user-${i}`, { id: `overflow-user-${i}`, role: 'USER' });
    }
    expect(_userCache.size).toBeLessThanOrEqual(10000);
  });

  it('should not return an entry after its TTL has elapsed', async () => {
    // Use a per-entry TTL override (50 ms) so we can test expiry without fake timers.
    _userCache.set('ttl-user', { id: 'ttl-user', role: 'USER' }, { ttl: 50 });
    expect(_userCache.get('ttl-user')).toBeDefined();

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(_userCache.get('ttl-user')).toBeUndefined();
  });
});

describe('isTokenRevoked', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return false when tokenBlacklist query fails (graceful degradation)', async () => {
    const dbError = new Error('MySQL connection failed');
    prisma.tokenBlacklist.findUnique.mockRejectedValueOnce(dbError);

    const result = await isTokenRevoked('some-token');
    expect(result).toBe(false);
  });

  it('should return false when token is not revoked', async () => {
    prisma.tokenBlacklist.findUnique.mockResolvedValueOnce(null);
    const result = await isTokenRevoked('valid-token');
    expect(result).toBe(false);
  });

  it('should return true when token is revoked', async () => {
    prisma.tokenBlacklist.findUnique.mockResolvedValueOnce({ token: 'revoked-token' });
    const result = await isTokenRevoked('revoked-token');
    expect(result).toBe(true);
  });
});

describe('authenticate middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should allow authenticated request through when isTokenRevoked DB error occurs', async () => {
    const dbError = new Error('MySQL connection timeout');
    prisma.tokenBlacklist.findUnique.mockRejectedValueOnce(dbError);
    jwt.verify.mockReturnValueOnce({ userId: 'user-1' });
    clearUserCache('user-1');
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1', email: 'alice@example.com', name: 'Alice',
      phone: null, address: null, role: 'USER'
    });

    const mockReq = { cookies: { jwt: 'valid-token' } };
    const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const mockNext = jest.fn();

    await authenticate(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith();
    expect(mockRes.status).not.toHaveBeenCalledWith(500);
    expect(mockReq.user.role).toBe('USER');
  });

  it('should return 401 when token is revoked', async () => {
    prisma.tokenBlacklist.findUnique.mockResolvedValueOnce({ token: 'revoked-token' });

    const mockReq = { cookies: { jwt: 'revoked-token' } };
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    const mockNext = jest.fn();

    await authenticate(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Token has been revoked' });
  });

  it('should call next() when token is valid and user exists', async () => {
    prisma.tokenBlacklist.findUnique.mockResolvedValueOnce(null);
    jwt.verify.mockReturnValueOnce({ userId: 'user-1' });
    clearUserCache('user-1');
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1', email: 'alice@example.com', name: 'Alice',
      phone: null, address: null, role: 'USER'
    });

    const mockReq = { cookies: { jwt: 'valid-token' } };
    const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const mockNext = jest.fn();

    await authenticate(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith();
    expect(mockReq.user.role).toBe('USER');
  });
});
