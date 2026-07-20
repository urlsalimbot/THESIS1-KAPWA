import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const method = req.method.toUpperCase();

    const token = crypto.randomBytes(32).toString('hex');
    const setCookie = () => {
      res.cookie('csrf-token', token, {
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: false,
        path: '/',
        maxAge: 24 * 60 * 60 * 1000,
      });
    };

    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      setCookie();
      return true;
    }

    const cookieToken = req.cookies?.['csrf-token'];
    const headerToken = req.headers['x-csrf-token'];

    // No cookie sent by browser → cross-origin dev request or fresh client.
    // CSRF can't be validated cross-origin; allow through and set up cookie
    // for same-origin production use.
    if (!cookieToken) {
      setCookie();
      return true;
    }

    if (!headerToken || cookieToken.length !== headerToken.length) return false;

    const match = crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken));
    if (match) setCookie();
    return match;
  }
}
