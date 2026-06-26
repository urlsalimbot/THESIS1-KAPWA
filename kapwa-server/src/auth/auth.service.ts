import { BCRYPT_SALT_ROUNDS } from './constants';
import { Logger, Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { generateTOTPSecret, generateTOTPUri, verifyTOTP } from './totp';
import { User } from './user.entity';
import { OtpService } from '../otp/otp.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private jwtService: JwtService,
    private otpService: OtpService,
  ) {}

  async register(data: { email: string; password: string; role?: string; fullName?: string }) {
    const existing = await this.userRepo.findOne({ where: { email: data.email } });
    if (existing) throw new ConflictException('Email already registered');

    const hashed = await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS);
    const user = this.userRepo.create({
      email: data.email,
      password: hashed,
      role: 'social_worker' as any,
      fullName: data.fullName,
      isActive: true,
    });
    await this.userRepo.save(user);
    return { id: user.id, email: user.email, role: user.role, fullName: user.fullName };
  }

  async validateUser(email: string, pass: string): Promise<User | null> {
    const user = await this.userRepo.findOne({ where: { email } });
    if (user && (await bcrypt.compare(pass, user.password))) return user;
    return null;
  }

  async login(user: User) {
    if (user.mfaEnabled) {
      const tempToken = this.jwtService.sign(
        { sub: user.id, email: user.email, role: user.role, mfaChallenge: true, tokenVersion: user.tokenVersion },
        { expiresIn: '5m' },
      );
      return { mfaRequired: true, tempToken };
    }

    if (user.role === 'coordinator') {
      if (!user.phone) throw new BadRequestException('Coordinator must have a phone number configured for OTP');
      await this.otpService.requestOtp(user.phone);
      const tempToken = this.jwtService.sign(
        { sub: user.id, email: user.email, role: user.role, smsOtpChallenge: true, tokenVersion: user.tokenVersion },
        { expiresIn: '5m' },
      );
      return { otpRequired: true, tempToken, phone: user.phone.replace(/\d(?=\d{4})/g, '*') };
    }

    return this.issueTokens(user);
  }

  private issueTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion };
    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, { expiresIn: '7d' }),
      user: { id: user.id, email: user.email, role: user.role, fullName: user.fullName }
    };
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  async findByIdWithSecret(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id }, select: ['id', 'email', 'role', 'fullName', 'mfaSecret', 'mfaEnabled', 'password', 'tokenVersion'] });
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken) as any;
      const user = await this.findByIdWithSecret(payload.sub);
      if (!user) throw new UnauthorizedException();

      if (payload.tokenVersion !== user.tokenVersion) {
        throw new UnauthorizedException('Refresh token has been revoked — please log in again');
      }

      user.tokenVersion += 1;
      await this.userRepo.save(user);

      return this.issueTokens(user);
    } catch (e) {
      this.logger.error('Refresh token validation error:', e);
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async setupMfa(userId: string) {
    const user = await this.findById(userId);
    if (!user) throw new UnauthorizedException();
    if (user.mfaEnabled) throw new BadRequestException('MFA already enabled');

    const secret = generateTOTPSecret();
    user.mfaSecret = secret;
    await this.userRepo.save(user);

    const otpauth = generateTOTPUri(secret, user.email, 'KAPWA-MSWDO');

    return { secret, otpauth };
  }

  async enableMfa(userId: string, code: string) {
    const user = await this.findByIdWithSecret(userId);
    if (!user) throw new UnauthorizedException();
    if (!user.mfaSecret) throw new BadRequestException('MFA not set up. Call setup first.');
    if (user.mfaEnabled) throw new BadRequestException('MFA already enabled');

    if (!verifyTOTP({ token: code, secret: user.mfaSecret })) {
      throw new BadRequestException('Invalid TOTP code');
    }

    user.mfaEnabled = true;
    await this.userRepo.save(user);
    return { mfaEnabled: true };
  }

  async disableMfa(userId: string, password: string) {
    const user = await this.findByIdWithSecret(userId);
    if (!user) throw new UnauthorizedException();
    if (!user.mfaEnabled) throw new BadRequestException('MFA not enabled');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new BadRequestException('Invalid password');

    user.mfaSecret = null as any;
    user.mfaEnabled = false;
    await this.userRepo.save(user);
    return { mfaEnabled: false };
  }

  async verifyMfaChallenge(tempToken: string, code: string) {
    try {
      const payload = this.jwtService.verify(tempToken) as any;
      if (!payload.mfaChallenge) throw new UnauthorizedException('Invalid challenge token');

      const user = await this.findByIdWithSecret(payload.sub);
      if (!user || !user.mfaEnabled || !user.mfaSecret) throw new UnauthorizedException();

      if (!verifyTOTP({ token: code, secret: user.mfaSecret })) {
        throw new BadRequestException('Invalid TOTP code');
      }

      return this.issueTokens(user);
    } catch (e) {
      if (e instanceof BadRequestException || e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('MFA verification failed');
    }
  }

  async verifySmsOtp(tempToken: string, otpCode: string) {
    try {
      const payload = this.jwtService.verify(tempToken) as any;
      if (!payload.smsOtpChallenge) throw new UnauthorizedException('Invalid challenge token');

      const user = await this.userRepo.findOne({ where: { id: payload.sub } });
      if (!user) throw new UnauthorizedException();

      if (!user.phone) throw new BadRequestException('User has no phone number configured');

      const valid = await this.otpService.verifyOtp(user.phone, otpCode);
      if (!valid) throw new BadRequestException('Invalid or expired OTP');

      return this.issueTokens(user);
    } catch (e) {
      if (e instanceof BadRequestException || e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('SMS OTP verification failed');
    }
  }
}
