import { AuthController } from './auth.controller';

/**
 * The auth surface is the only place an attacker can guess a credential, so
 * every route that verifies one — or mails a link — must carry a budget
 * tighter than the global 60 req/min bucket (audit 2.4).
 *
 * The check reads the decorator metadata rather than exercising the guard:
 * what matters is that the override EXISTS on these handlers, so a future
 * route added without one fails here instead of in production.
 */
const SENSITIVE_ROUTES = [
  'register',
  'login',
  'verifyLoginOtp',
  'verifyMfa',
  'resendEmailMfa',
  'verifyEmailMfa',
  'verifyEmail',
  'resendVerification',
  'forgotPassword',
  'resetPassword',
  'changeEmail',
  'confirmEmailChange',
  'updatePhone',
  'requestPersonLink',
  'verifyPersonLink',
] as const;

/** `@Throttle` writes `THROTTLER:LIMIT<name>` per bucket; read them all. */
function declaredLimits(handler: unknown): number[] {
  return Reflect.getMetadataKeys(handler as object)
    .filter((k): k is string => typeof k === 'string' && k.startsWith('THROTTLER:LIMIT'))
    .map((k) => Reflect.getMetadata(k, handler as object))
    .filter((v): v is number => typeof v === 'number');
}

describe('AuthController throttling', () => {
  it.each(SENSITIVE_ROUTES)('%s carries its own, tighter rate limit', (method) => {
    const handler = (AuthController.prototype as unknown as Record<string, unknown>)[method];
    expect(typeof handler).toBe('function');

    const limits = declaredLimits(handler);
    expect(limits.length).toBeGreaterThan(0);
    // Stricter than the global bucket configured in app.module.
    expect(Math.min(...limits)).toBeLessThan(60);
  });

  it('leaves session plumbing on the global bucket', () => {
    // `refresh`/`logout` are session lifecycle, not credential checks.
    for (const method of ['refresh', 'logout']) {
      const handler = (AuthController.prototype as unknown as Record<string, unknown>)[method];
      expect(declaredLimits(handler)).toEqual([]);
    }
  });
});
