import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import * as crypto from 'crypto';

// Double-submit CSRF protection.
//
// The token is not a session cookie: it is written as a readable `csrf-token`
// cookie so the SPA can echo it in the `X-CSRF-Token` header, and the guard
// requires the two to match on every unsafe request. Bearer-token auth already
// makes classic CSRF hard, but the contract must actually be enforced.
//
// Exempt: pre-session endpoints. A fresh browser's first request can legitimately
// be an unsafe one (login), and it cannot have the cookie yet.
const UNSAFE_EXEMPT_PATHS = [
  '/auth/login',
  '/auth/login/otp-verify',
  '/auth/register',
  '/auth/refresh',
  '/auth/mfa/verify',
  '/auth/mfa/email/verify',
  '/auth/mfa/email/resend',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
  '/auth/resend-verification',
  '/auth/confirm-email-change',
  '/contact-messages',
];

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const method = String(req.method || 'GET').toUpperCase();

    const cookieToken = req.cookies?.['csrf-token'];
    const rawHeader = req.headers['x-csrf-token'];
    const headerToken = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

    // Bootstrap the token on any request that does not carry one.
    // httpOnly is intentionally false: this is the double-submit CSRF pattern,
    // so the SPA must read the token and echo it in X-CSRF-Token. It is not a
    // session cookie. sameSite=lax + secure-in-prod limit exposure. Scanners
    // flag "Cookie No HttpOnly" here; it is expected.
    if (!cookieToken) {
      res.cookie('csrf-token', crypto.randomBytes(32).toString('hex'), {
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: false,
        path: '/',
        maxAge: 24 * 60 * 60 * 1000,
      });
    }

    // Safe methods carry no side effects.
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return true;

    const path = String(req.originalUrl || req.url || '').split('?')[0];
    if (UNSAFE_EXEMPT_PATHS.some((p) => path.endsWith(p))) return true;

    // Every other unsafe request must present a matching token. Missing or
    // mismatched tokens are rejected — the previous "only validate when both are
    // present" behaviour let any unauthenticated POST through.
    if (!cookieToken || typeof headerToken !== 'string' || headerToken.length === 0) {
      throw new ForbiddenException('Missing CSRF token');
    }
    if (headerToken.length !== cookieToken.length) {
      throw new ForbiddenException('Invalid CSRF token');
    }
    try {
      if (!crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) {
        throw new ForbiddenException('Invalid CSRF token');
      }
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      throw new ForbiddenException('Invalid CSRF token');
    }
    return true;
  }
}
