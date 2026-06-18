import { security, UserSessionPayload } from './security';

describe('Security Helper Tests', () => {
  it('should hash a password and verify it correctly', async () => {
    const password = 'mySecretPassword123';
    const hash = await security.hashPassword(password);
    
    expect(hash).not.toBe(password);
    expect(hash.length).toBeGreaterThan(20);

    const match = await security.comparePassword(password, hash);
    expect(match).toBe(true);

    const wrongMatch = await security.comparePassword('wrongPassword', hash);
    expect(wrongMatch).toBe(false);
  });

  it('should sign and verify JWT tokens correctly', () => {
    const payload: UserSessionPayload = {
      userId: 'test-user-id',
      name: 'Test User',
      email: 'test@example.com',
      role: 'Solicitante',
      permissions: ['create_tickets'],
      companyId: 'test-company-id',
    };

    const token = security.signToken(payload);
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');

    const decoded = security.verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe(payload.userId);
    expect(decoded?.role).toBe(payload.role);
    expect(decoded?.companyId).toBe(payload.companyId);
  });

  it('should return null for expired or invalid tokens', () => {
    const invalidToken = 'invalid.jwt.token';
    const decoded = security.verifyToken(invalidToken);
    expect(decoded).toBeNull();
  });
});
