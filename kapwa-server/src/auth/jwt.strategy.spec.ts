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
});
