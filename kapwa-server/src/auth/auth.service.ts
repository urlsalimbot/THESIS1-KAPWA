import { BCRYPT_SALT_ROUNDS } from './constants';
import { Logger, Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { generateTOTPSecret, generateTOTPUri, verifyTOTP } from './totp';
import { User } from './user.entity';
import { OtpService } from '../otp/otp.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private jwtService: JwtService,
    private otpService: OtpService,
    private emailService: EmailService,
  ) {}

  async register(data: { email: string; password: string; role?: string; fullName?: string; phone?: string }) {
    const existing = await this.userRepo.findOne({ where: { email: data.email } });
    if (existing) throw new ConflictException('Email already registered');

    const hashed = await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const user = this.userRepo.create({
      email: data.email,
      password: hashed,
      role: data.role || ('claimant' as any),
      fullName: data.fullName,
      phone: data.phone,
      isActive: true,
      emailVerified: false,
      verificationToken,
      verificationTokenExpiresAt,
    });
    await this.userRepo.save(user);

    await this.emailService.sendVerificationEmail(user.email, verificationToken);

    return { message: 'Registration successful. Please check your email to verify your account.', email: user.email };
  }

  async validateUser(email: string, pass: string): Promise<User | null> {
    const user = await this.userRepo.findOne({ where: { email } });
    if (user && (await bcrypt.compare(pass, user.password))) return user;
    return null;
  }

  async login(user: User) {
    if (!user.emailVerified) {
      throw new UnauthorizedException('Please verify your email before logging in. Check your inbox for the verification link.');
    }

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
    return this.userRepo.findOne({ where: { id }, select: ['id', 'email', 'role', 'fullName', 'mfaSecret', 'mfaEnabled', 'password', 'tokenVersion', 'emailVerified'] });
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

  async changePassword(userId: string, body: { currentPassword: string; newPassword: string }) {
    const user = await this.findByIdWithSecret(userId);
    if (!user) throw new UnauthorizedException();

    const valid = await bcrypt.compare(body.currentPassword, user.password);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const hashed = await bcrypt.hash(body.newPassword, BCRYPT_SALT_ROUNDS);
    user.password = hashed;
    await this.userRepo.save(user);

    return { message: 'Password changed successfully' };
  }

  async verifyEmail(token: string) {
    const user = await this.userRepo.findOne({ where: { verificationToken: token } });
    if (!user) throw new BadRequestException('Invalid or expired verification token');

    if (user.verificationTokenExpiresAt && user.verificationTokenExpiresAt < new Date()) {
      throw new BadRequestException('Verification token has expired. Request a new one.');
    }

    user.emailVerified = true;
    user.verificationToken = null as any;
    user.verificationTokenExpiresAt = null as any;
    await this.userRepo.save(user);

    return { message: 'Email verified successfully. You can now log in.' };
  }

  async resendVerificationEmail(email: string) {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      // Don't reveal whether the email exists
      return { message: 'If an account with that email exists, a verification link has been sent.' };
    }
    if (user.emailVerified) {
      return { message: 'Email is already verified.' };
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    user.verificationToken = verificationToken;
    user.verificationTokenExpiresAt = verificationTokenExpiresAt;
    await this.userRepo.save(user);

    await this.emailService.sendVerificationEmail(user.email, verificationToken);
    return { message: 'Verification email sent. Please check your inbox.' };
  }

  async forgotPassword(email: string) {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      return { message: 'If an account with that email exists, a password reset link has been sent.' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    user.resetToken = resetToken;
    user.resetTokenExpiresAt = resetTokenExpiresAt;
    await this.userRepo.save(user);

    await this.emailService.sendForgotPasswordEmail(user.email, resetToken);
    return { message: 'If an account with that email exists, a password reset link has been sent.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.userRepo.findOne({ where: { resetToken: token } });
    if (!user) throw new BadRequestException('Invalid or expired reset token');

    if (user.resetTokenExpiresAt && user.resetTokenExpiresAt < new Date()) {
      throw new BadRequestException('Reset token has expired. Request a new one.');
    }

    const hashed = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    user.password = hashed;
    user.resetToken = null as any;
    user.resetTokenExpiresAt = null as any;
    await this.userRepo.save(user);

    return { message: 'Password reset successfully. You can now log in with your new password.' };
  }

  async changeEmail(userId: string, body: { newEmail: string; currentPassword: string }) {
    const user = await this.findByIdWithSecret(userId);
    if (!user) throw new UnauthorizedException();

    const valid = await bcrypt.compare(body.currentPassword, user.password);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const existing = await this.userRepo.findOne({ where: { email: body.newEmail } });
    if (existing) throw new ConflictException('Email already in use');

    const newEmailToken = crypto.randomBytes(32).toString('hex');
    const newEmailTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    user.newEmail = body.newEmail;
    user.newEmailToken = newEmailToken;
    user.newEmailTokenExpiresAt = newEmailTokenExpiresAt;
    await this.userRepo.save(user);

    await this.emailService.sendEmailChangeVerification(body.newEmail, newEmailToken);
    return { message: 'Verification sent to the new email address. Please check your inbox to confirm.' };
  }

  async confirmEmailChange(token: string) {
    const user = await this.userRepo.findOne({ where: { newEmailToken: token } });
    if (!user) throw new BadRequestException('Invalid or expired email change token');

    if (user.newEmailTokenExpiresAt && user.newEmailTokenExpiresAt < new Date()) {
      throw new BadRequestException('Email change token has expired. Try again.');
    }

    user.email = user.newEmail!;
    user.newEmail = null as any;
    user.newEmailToken = null as any;
    user.newEmailTokenExpiresAt = null as any;
    user.emailVerified = true;
    await this.userRepo.save(user);

    return { message: 'Email changed successfully.' };
  }

  async updatePhone(userId: string, phone: string) {
    const user = await this.findByIdWithSecret(userId);
    if (!user) throw new UnauthorizedException();

    user.phone = phone;
    await this.userRepo.save(user);

    return { message: 'Phone number updated successfully', phone };
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
