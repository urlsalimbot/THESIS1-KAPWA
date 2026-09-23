import { ForbiddenException } from '@nestjs/common';
import { CsrfGuard } from './csrf.guard';

function ctx(method: string, url: string, cookies: Record<string, string> = {}, headers: Record<string, unknown> = {}) {
  const res = { cookie: jest.fn() };
  const req = { method, originalUrl: url, url, cookies, headers };
  return {
    res,
    guard: new CsrfGuard(),
    context: { switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }) } as any,
  };
}

describe('CsrfGuard', () => {
  it('allows safe methods without a token', () => {
    const { guard, context } = ctx('GET', '/api/v1/cases');
    expect(guard.canActivate(context)).toBe(true);
  });

  it('sets the cookie when the request has none', () => {
    const { guard, context, res } = ctx('GET', '/api/v1/cases');
    guard.canActivate(context);
    expect(res.cookie).toHaveBeenCalledWith('csrf-token', expect.any(String), expect.objectContaining({ httpOnly: false }));
  });

  it('rejects an unsafe request with no token', () => {
    const { guard, context } = ctx('POST', '/api/v1/intake');
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects an unsafe request with a mismatched token', () => {
    const { guard, context } = ctx('POST', '/api/v1/intake', { 'csrf-token': 'a'.repeat(64) }, { 'x-csrf-token': 'b'.repeat(64) });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects an unsafe request with only a header token', () => {
    const { guard, context } = ctx('POST', '/api/v1/intake', {}, { 'x-csrf-token': 'a'.repeat(64) });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows an unsafe request with a matching token', () => {
    const token = 'c'.repeat(64);
    const { guard, context } = ctx('PATCH', '/api/v1/cases/1/status', { 'csrf-token': token }, { 'x-csrf-token': token });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('exempts pre-session endpoints', () => {
    for (const path of ['/api/v1/auth/login', '/api/v1/auth/register', '/api/v1/auth/refresh', '/api/v1/contact-messages']) {
      const { guard, context } = ctx('POST', path);
      expect(guard.canActivate(context)).toBe(true);
    }
  });
});
