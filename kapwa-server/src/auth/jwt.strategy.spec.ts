import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy — disabled accounts', () => {
  const config = { get: () => 'test-secret' } as any;
  const make = (userRepo: any) => new JwtStrategy(userRepo, config);

  it('rejects a disabled account even with an unexpired token', async () => {
    const strategy = make({ findOne: jest.fn().mockResolvedValue({ id: 'u1', isActive: false }) });
    await expect(strategy.validate({ sub: 'u1', role: 'admin' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns the user when the account is active', async () => {
    const user = { id: 'u1', isActive: true };
    const strategy = make({ findOne: jest.fn().mockResolvedValue(user) });
    await expect(strategy.validate({ sub: 'u1', role: 'admin' })).resolves.toBe(user);
  });

  it('rejects an unknown user', async () => {
    const strategy = make({ findOne: jest.fn().mockResolvedValue(null) });
    await expect(strategy.validate({ sub: 'nope', role: 'admin' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  // The password-only token minted by /auth/login when MFA is on. Before this
  // check it was accepted on every route, so calling /auth/login and skipping
  // /auth/mfa/verify turned MFA into decoration.
  it('rejects the MFA challenge token on a protected route', async () => {
    const strategy = make({ findOne: jest.fn().mockResolvedValue({ id: 'u1', isActive: true, tokenVersion: 0 }) });
    await expect(
      strategy.validate({ sub: 'u1', role: 'admin', mfaChallenge: true, tokenVersion: 0 }),
    ).rejects.toThrow(/multi-factor/i);
  });

  it('rejects a challenge token from the SMS path too', async () => {
    const strategy = make({ findOne: jest.fn().mockResolvedValue({ id: 'u1', isActive: true, tokenVersion: 0 }) });
    await expect(
      strategy.validate({ sub: 'u1', role: 'admin', smsOtpChallenge: true } as any),
    ).rejects.toThrow(/multi-factor/i);
  });

  it('rejects an access token minted before logout bumped the tokenVersion', async () => {
    const strategy = make({ findOne: jest.fn().mockResolvedValue({ id: 'u1', isActive: true, tokenVersion: 2 }) });
    await expect(
      strategy.validate({ sub: 'u1', role: 'admin', tokenVersion: 1 }),
    ).rejects.toThrow(/session ended/i);
  });
});
