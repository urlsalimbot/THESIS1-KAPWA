import { BCRYPT_SALT_ROUNDS } from './constants';
import { Logger, Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { generateTOTPSecret, generateTOTPUri, verifyTOTP } from './totp';
import { User } from './user.entity';
import { UserToken } from './user-token.entity';
import { UserBarangayAssignment } from './user-barangay-assignment.entity';
import { Person } from '../beneficiaries/person.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { OtpService } from '../otp/otp.service';
import { SmsGatewayService } from '../otp/sms-gateway.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly LINK_CODE_EXPIRY_MS = 5 * 60 * 1000;
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(UserToken)
    private tokenRepo: Repository<UserToken>,
    @InjectRepository(Person)
    private personRepo: Repository<Person>,
    @InjectRepository(Beneficiary)
    private benRepo: Repository<Beneficiary>,
    @InjectRepository(UserBarangayAssignment)
    private barangayRepo: Repository<UserBarangayAssignment>,
    private jwtService: JwtService,
    private otpService: OtpService,
    private smsGateway: SmsGatewayService,
    private emailService: EmailService,
  ) {}

  private async upsertToken(userId: string, purpose: string, opts: { token: string; expiresAt?: Date; meta?: Record<string, any> }) {
    const row = this.tokenRepo.create({ userId, purpose, token: opts.token, expiresAt: opts.expiresAt, meta: opts.meta });
    await this.tokenRepo.delete({ userId, purpose });
    await this.tokenRepo.save(row);
  }

  private async deleteTokens(userId: string, purpose: string) {
    await this.tokenRepo.delete({ userId, purpose });
  }

  async register(data: { email: string; password: string; role?: string; fullName?: string; phone?: string; dob?: string; assignedBarangay?: string }) {
    const existing = await this.userRepo.findOne({ where: { email: data.email } });
    if (existing) throw new ConflictException('Email already registered');

    const hashed = await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = this.userRepo.create({
      email: data.email,
      password: hashed,
      role: data.role || ('claimant' as any),
      fullName: data.fullName,
      phone: data.phone,
      isActive: true,
      emailVerified: false,
    });
    await this.userRepo.save(user);
    if (data.assignedBarangay) {
      await this.barangayRepo.save(this.barangayRepo.create({
        userId: user.id,
        barangay: data.assignedBarangay,
        isPrimary: true,
      }));
    }
    await this.tokenRepo.save(this.tokenRepo.create({
      userId: user.id,
      purpose: 'email_verification',
      token: verificationToken,
      expiresAt: verificationTokenExpiresAt,
    }));

    let personFound = false;
    let contactType: 'sms' | 'email' | null = null;

    if (data.fullName && data.dob && data.phone) {
      const inputDob = data.dob.replace(/-/g, '');
      const inputName = data.fullName!.toLowerCase().replace(/\s+/g, ' ').trim();
      const rawPhone = data.phone.replace(/\D/g, '');
      const candidates = await this.personRepo
        .createQueryBuilder('p')
        .where('EXISTS (SELECT 1 FROM person_contacts pc WHERE pc.person_id = p.id AND pc.contact_type = \'phone\' AND (pc.value = :p1 OR pc.value = :p2))', { p1: data.phone, p2: rawPhone })
        .getMany();

      const match = candidates.find(p => {
        let personDob = '';
        if (p.dob instanceof Date) {
          personDob = `${p.dob.getFullYear()}${String(p.dob.getMonth()+1).padStart(2,'0')}${String(p.dob.getDate()).padStart(2,'0')}`;
        } else if (p.dob) {
          personDob = String(p.dob).replace(/-/g, '').slice(0, 8);
        }
        if (personDob !== inputDob) return false;
        const personWords = `${p.surname} ${p.firstName}`.toLowerCase().replace(/,\s*/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ');
        const inputWords = inputName.replace(/,\s*/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ');
        return personWords === inputWords;
      });

      if (match) {
        const code = String(100000 + Math.floor(Math.random() * 900000));
        const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

        user.pendingPersonId = match.id;
        user.personLinkCode = hashedCode;
        user.personLinkCodeExpiresAt = new Date(Date.now() + this.LINK_CODE_EXPIRY_MS);
        await this.userRepo.save(user);

        if (match.phone) {
          const smsResult = await this.smsGateway.sendSms(match.phone, `Your KAPWA verification code is: ${code}. Valid for 5 minutes.`);
          if (smsResult.success) contactType = 'sms';
        }
        if (!contactType && (match.email || data.email)) {
          await this.emailService.sendOtpEmail(match.email || data.email, code);
          contactType = 'email';
        }
        personFound = true;
      }
    }

    await this.emailService.sendVerificationEmail(user.email, verificationToken);

    const result: any = { message: 'Registration successful. Please check your email to verify your account.', email: user.email };
    if (personFound) {
      result.personMatched = true;
      result.contactType = contactType;
      result.message = 'Registration successful. We found your record — please verify with the code sent to your ' + (contactType === 'sms' ? 'phone' : 'email') + '.';
    }
    return result;
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
    const tokenRow = await this.tokenRepo.findOne({ where: { purpose: 'email_verification', token } });
    if (!tokenRow) throw new BadRequestException('Invalid or expired verification token');

    if (tokenRow.expiresAt && tokenRow.expiresAt < new Date()) {
      throw new BadRequestException('Verification token has expired. Request a new one.');
    }

    const user = await this.userRepo.findOne({ where: { id: tokenRow.userId } });
    if (!user) throw new BadRequestException('Invalid or expired verification token');

    user.emailVerified = true;
    await this.userRepo.save(user);
    await this.deleteTokens(user.id, 'email_verification');

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
    await this.upsertToken(user.id, 'email_verification', { token: verificationToken, expiresAt: verificationTokenExpiresAt });

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
    await this.upsertToken(user.id, 'password_reset', { token: resetToken, expiresAt: resetTokenExpiresAt });

    await this.emailService.sendForgotPasswordEmail(user.email, resetToken);
    return { message: 'If an account with that email exists, a password reset link has been sent.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenRow = await this.tokenRepo.findOne({ where: { purpose: 'password_reset', token } });
    if (!tokenRow) throw new BadRequestException('Invalid or expired reset token');

    if (tokenRow.expiresAt && tokenRow.expiresAt < new Date()) {
      throw new BadRequestException('Reset token has expired. Request a new one.');
    }

    const user = await this.userRepo.findOne({ where: { id: tokenRow.userId } });
    if (!user) throw new BadRequestException('Invalid or expired reset token');

    const hashed = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    user.password = hashed;
    await this.userRepo.save(user);
    await this.deleteTokens(user.id, 'password_reset');

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
    await this.upsertToken(user.id, 'change_email', {
      token: newEmailToken,
      expiresAt: newEmailTokenExpiresAt,
      meta: { newEmail: body.newEmail },
    });

    await this.emailService.sendEmailChangeVerification(body.newEmail, newEmailToken);
    return { message: 'Verification sent to the new email address. Please check your inbox to confirm.' };
  }

  async confirmEmailChange(token: string) {
    const tokenRow = await this.tokenRepo.findOne({ where: { purpose: 'change_email', token } });
    if (!tokenRow) throw new BadRequestException('Invalid or expired email change token');

    if (tokenRow.expiresAt && tokenRow.expiresAt < new Date()) {
      throw new BadRequestException('Email change token has expired. Try again.');
    }

    const newEmail = (tokenRow.meta as any)?.newEmail;
    if (!newEmail) throw new BadRequestException('Invalid or expired email change token');

    const user = await this.userRepo.findOne({ where: { id: tokenRow.userId } });
    if (!user) throw new BadRequestException('Invalid or expired email change token');

    user.email = newEmail;
    user.emailVerified = true;
    await this.userRepo.save(user);
    await this.deleteTokens(user.id, 'change_email');

    return { message: 'Email changed successfully.' };
  }

  async updatePhone(userId: string, phone: string) {
    const user = await this.findByIdWithSecret(userId);
    if (!user) throw new UnauthorizedException();

    user.phone = phone;
    await this.userRepo.save(user);

    return { message: 'Phone number updated successfully', phone };
  }

  async requestPersonLink(phone: string, dob: string, email: string) {
    const dobNorm = dob.replace(/-/g, '');
    const rawPhone = phone.replace(/\D/g, '');
    const candidate = await this.personRepo
      .createQueryBuilder('p')
      .where('EXISTS (SELECT 1 FROM person_contacts pc WHERE pc.person_id = p.id AND pc.contact_type = \'phone\' AND (pc.value = :p1 OR pc.value = :p2))', { p1: phone, p2: rawPhone })
      .getOne();

    if (!candidate) throw new BadRequestException('No matching person record found');

    let personDob = '';
    if (candidate.dob instanceof Date) {
      personDob = `${candidate.dob.getFullYear()}${String(candidate.dob.getMonth()+1).padStart(2,'0')}${String(candidate.dob.getDate()).padStart(2,'0')}`;
    } else if (candidate.dob) {
      personDob = String(candidate.dob).replace(/-/g, '').slice(0, 8);
    }
    if (personDob !== dobNorm) throw new BadRequestException('No matching person record found');

    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) throw new UnauthorizedException('User not found');

    const code = String(100000 + Math.floor(Math.random() * 900000));
    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

    user.pendingPersonId = candidate.id;
    user.personLinkCode = hashedCode;
    user.personLinkCodeExpiresAt = new Date(Date.now() + this.LINK_CODE_EXPIRY_MS);
    await this.userRepo.save(user);

    let contactType: 'sms' | 'email' | null = null;
    if (candidate.phone) {
      const smsResult = await this.smsGateway.sendSms(candidate.phone, `Your KAPWA verification code is: ${code}. Valid for 5 minutes.`);
      if (smsResult.success) contactType = 'sms';
    }
    if (!contactType && (candidate.email || email)) {
      await this.emailService.sendOtpEmail(candidate.email || email, code);
      contactType = 'email';
    }

    return { message: `Code sent to your ${contactType === 'sms' ? 'phone' : 'email'}`, contactType };
  }

  async verifyPersonLink(email: string, code: string) {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) throw new UnauthorizedException('User not found');
    if (!user.pendingPersonId || !user.personLinkCode || !user.personLinkCodeExpiresAt) {
      throw new BadRequestException('No pending link request. Please request a link code first.');
    }
    if (user.personLinkCodeExpiresAt < new Date()) {
      throw new BadRequestException('Link code has expired. Please request a new one.');
    }

    const hashedInput = crypto.createHash('sha256').update(code).digest('hex');
    if (hashedInput !== user.personLinkCode) {
      throw new BadRequestException('Invalid verification code');
    }

    const personId = user.pendingPersonId;
    user.personId = personId;
    user.pendingPersonId = null as any;
    user.personLinkCode = null as any;
    user.personLinkCodeExpiresAt = null as any;
    await this.userRepo.save(user);

    const beneficiary = await this.benRepo.findOne({ where: { personId } });
    if (beneficiary) {
      beneficiary.userId = user.id;
      await this.benRepo.save(beneficiary);
    }

    return { message: 'Your account has been linked. You can now access your beneficiary profile.', personId };
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
