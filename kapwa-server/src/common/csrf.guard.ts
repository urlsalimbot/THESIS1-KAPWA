import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const method = req.method.toUpperCase();

    const setCookie = (token: string) => {
      const maxAge = 24 * 60 * 60 * 1000;
      res.cookie('csrf-token', token, {
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: false,
        path: '/',
        maxAge,
      });
    };

    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      setCookie(crypto.randomBytes(32).toString('hex'));
      return true;
    }

    const cookieToken = req.cookies?.['csrf-token'];
    const headerToken = req.headers['x-csrf-token'];
    if (!cookieToken || !headerToken) return false;
    if (cookieToken.length !== headerToken.length) return false;
    const match = crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken));
    if (match) setCookie(crypto.randomBytes(32).toString('hex'));
    return match;
  }
}
