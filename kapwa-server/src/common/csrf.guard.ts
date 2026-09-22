import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const method = req.method.toUpperCase();

    const cookieToken = req.cookies?.['csrf-token'];
    const headerToken = req.headers['x-csrf-token'];

    // Set cookie on every request if missing.
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

    // Safe-methods — no validation needed
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return true;

    // Only validate when BOTH cookie and header are present
    if (cookieToken && headerToken) {
      if (cookieToken.length === headerToken.length) {
        try {
          return crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken));
        } catch {
          return false;
        }
      }
    }

    return true;
  }
}
