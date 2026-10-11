import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    config: ConfigService,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('FATAL: JWT_SECRET environment variable is required');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: { sub: string; role: string; barangay?: string; tokenVersion?: number; mfaChallenge?: boolean }) {
    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException();
    // A disabled account loses access immediately, even with a token that is
    // still within its expiry window.
    if (user.isActive === false) throw new UnauthorizedException('This account has been disabled');
    // The MFA challenge token proves the PASSWORD only. It must never open a
    // route: before this check, `POST /auth/login` with a stolen password
    // returned a 5-minute token that every protected route accepted — MFA
    // bypassed by simply not calling /auth/mfa/verify.
    if (payload.mfaChallenge || (payload as { smsOtpChallenge?: boolean }).smsOtpChallenge) {
      throw new UnauthorizedException('Multi-factor verification is not complete');
    }
    // Logout and password change bump `tokenVersion`, so an access token minted
    // before them dies at once instead of at its exp.
    if (payload.tokenVersion !== undefined && payload.tokenVersion !== user.tokenVersion) {
      throw new UnauthorizedException('Session ended — please log in again');
    }
    return user;
  }
}
