import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, MfaMethod } from './user.entity';
import { UserToken } from './user-token.entity';
import { UserBarangayAssignment } from './user-barangay-assignment.entity';
import { Person } from '../beneficiaries/person.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { OtpService } from '../otp/otp.service';
import { SmsGatewayService } from '../otp/sms-gateway.service';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

jest.mock('bcrypt');

describe('AuthService — email OTP MFA', () => {
  let service: AuthService;
  let repoMock: Partial<Repository<User>>;
  let jwtMock: Partial<JwtService>;
  let emailMock: { [k: string]: jest.Mock };

  const hash = (code: string) => crypto.createHash('sha256').update(code).digest('hex');

  beforeEach(async () => {
    repoMock = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    const tokenRepoMock = { findOne: jest.fn(), create: jest.fn(), save: jest.fn(), delete: jest.fn() };
    jwtMock = { sign: jest.fn().mockReturnValue('signed-token'), verify: jest.fn() };
    const otpMock = { requestOtp: jest.fn(), verifyOtp: jest.fn() };
    const personRepoMock = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    const benRepoMock = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    const barangayRepoMock = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    const smsMock = { sendSms: jest.fn() };
    emailMock = { sendOtpEmail: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: repoMock },
        { provide: getRepositoryToken(UserToken), useValue: tokenRepoMock },
        { provide: getRepositoryToken(Person), useValue: personRepoMock },
        { provide: getRepositoryToken(Beneficiary), useValue: benRepoMock },
        { provide: getRepositoryToken(UserBarangayAssignment), useValue: barangayRepoMock },
        { provide: JwtService, useValue: jwtMock },
        { provide: OtpService, useValue: otpMock },
        { provide: SmsGatewayService, useValue: smsMock },
        { provide: EmailService, useValue: emailMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  const emailUser = (over: Partial<User> = {}) => ({
    id: 'u1',
    email: 'user@test.com',
    role: 'social_worker' as any,
    fullName: 'Email User',
    emailVerified: true,
    tokenVersion: 0,
    mfaEnabled: true,
    mfaMethod: MfaMethod.EMAIL,
    ...over,
  } as User);

  describe('login', () => {
    it('sends an email code and returns the email challenge', async () => {
      const user = emailUser();
      const res = await service.login(user) as any;

      expect(res).toMatchObject({ mfaRequired: true, mfaMethod: 'email', tempToken: 'signed-token' });
      expect(emailMock.sendOtpEmail).toHaveBeenCalledTimes(1);

      const [to, code] = emailMock.sendOtpEmail.mock.calls[0];
      expect(to).toBe('user@test.com');
      expect(code).toMatch(/^\d{6}$/);
      // Only the hash is persisted, never the plaintext code.
      expect(user.emailOtpCode).toBe(hash(code));
      expect(user.emailOtpCode).not.toBe(code);
      expect(user.emailOtpExpiresAt!.getTime()).toBeGreaterThan(Date.now());
    });

    it('reuses a fresh pending code instead of emailing again', async () => {
      const user = emailUser({
        emailOtpCode: hash('123456'),
        emailOtpExpiresAt: new Date(Date.now() + 290_000),
      });
      const res = await service.login(user) as any;

      expect(res.mfaMethod).toBe('email');
      expect(emailMock.sendOtpEmail).not.toHaveBeenCalled();
    });

    it('returns a TOTP challenge without emailing for TOTP accounts', async () => {
      const user = emailUser({ mfaMethod: MfaMethod.TOTP, mfaSecret: 'SECRET' });
      const res = await service.login(user) as any;

      expect(res).toMatchObject({ mfaRequired: true, mfaMethod: 'totp' });
      expect(emailMock.sendOtpEmail).not.toHaveBeenCalled();
    });

    it('treats a missing method as TOTP (backward compatibility)', async () => {
      const user = emailUser({ mfaMethod: null, mfaSecret: 'SECRET' });
      const res = await service.login(user) as any;

      expect(res.mfaMethod).toBe('totp');
      expect(emailMock.sendOtpEmail).not.toHaveBeenCalled();
    });
  });

  describe('setupEmailMfa', () => {
    it('sends a code to a verified email', async () => {
      (repoMock.findOne as jest.Mock).mockResolvedValue(emailUser({ mfaEnabled: false, mfaMethod: null }));
      const res = await service.setupEmailMfa('u1');

      expect(res.emailDelivered).toBe(true);
      expect(emailMock.sendOtpEmail).toHaveBeenCalledTimes(1);
    });

    it('rejects when MFA is already enabled', async () => {
      (repoMock.findOne as jest.Mock).mockResolvedValue(emailUser());
      await expect(service.setupEmailMfa('u1')).rejects.toThrow('MFA already enabled');
    });

    it('rejects when the email is not verified', async () => {
      (repoMock.findOne as jest.Mock).mockResolvedValue(emailUser({ mfaEnabled: false, emailVerified: false }));
      await expect(service.setupEmailMfa('u1')).rejects.toThrow('Verify your email');
    });
  });

  describe('enableEmailMfa', () => {
    it('activates email MFA with the code sent to the inbox', async () => {
      const user = emailUser({
        mfaEnabled: false,
        mfaMethod: null,
        emailOtpCode: hash('654321'),
        emailOtpExpiresAt: new Date(Date.now() + 60_000),
      });
      (repoMock.findOne as jest.Mock).mockResolvedValue(user);

      const res = await service.enableEmailMfa('u1', '654321');

      expect(res).toEqual({ mfaEnabled: true, mfaMethod: 'email' });
      expect(user.mfaMethod).toBe('email');
      expect(user.emailOtpCode).toBeNull();
      expect(repoMock.save).toHaveBeenCalled();
    });

    it('rejects an invalid code', async () => {
      const user = emailUser({
        mfaEnabled: false,
        emailOtpCode: hash('654321'),
        emailOtpExpiresAt: new Date(Date.now() + 60_000),
      });
      (repoMock.findOne as jest.Mock).mockResolvedValue(user);

      await expect(service.enableEmailMfa('u1', '000000')).rejects.toThrow('Invalid or expired');
    });

    it('rejects an expired code and clears it', async () => {
      const user = emailUser({
        mfaEnabled: false,
        emailOtpCode: hash('654321'),
        emailOtpExpiresAt: new Date(Date.now() - 1000),
      });
      (repoMock.findOne as jest.Mock).mockResolvedValue(user);

      await expect(service.enableEmailMfa('u1', '654321')).rejects.toThrow('Invalid or expired');
      expect(user.emailOtpCode).toBeNull();
    });
  });

  describe('verifyEmailMfa', () => {
    const challenge = () => (jwtMock.verify as jest.Mock).mockReturnValue({
      sub: 'u1', mfaChallenge: true, mfaMethod: 'email', tokenVersion: 0,
    });

    it('issues tokens for a valid code and clears the pending code', async () => {
      challenge();
      const user = emailUser({ emailOtpCode: hash('112233'), emailOtpExpiresAt: new Date(Date.now() + 60_000) });
      (repoMock.findOne as jest.Mock).mockResolvedValue(user);

      const res = await service.verifyEmailMfa('temp', '112233') as any;

      expect(res.accessToken).toBe('signed-token');
      expect(user.emailOtpCode).toBeNull();
      expect(repoMock.save).toHaveBeenCalled();
    });

    it('rejects a wrong code', async () => {
      challenge();
      const user = emailUser({ emailOtpCode: hash('112233'), emailOtpExpiresAt: new Date(Date.now() + 60_000) });
      (repoMock.findOne as jest.Mock).mockResolvedValue(user);

      await expect(service.verifyEmailMfa('temp', '999999')).rejects.toThrow('Invalid or expired');
    });

    it('rejects a challenge token issued for TOTP', async () => {
      (jwtMock.verify as jest.Mock).mockReturnValue({ sub: 'u1', mfaChallenge: true, mfaMethod: 'totp', tokenVersion: 0 });
      const user = emailUser({ emailOtpCode: hash('112233'), emailOtpExpiresAt: new Date(Date.now() + 60_000) });
      (repoMock.findOne as jest.Mock).mockResolvedValue(user);

      await expect(service.verifyEmailMfa('temp', '112233')).rejects.toThrow('Invalid challenge token');
    });
  });

  describe('resendEmailMfa', () => {
    const challenge = () => (jwtMock.verify as jest.Mock).mockReturnValue({
      sub: 'u1', mfaChallenge: true, mfaMethod: 'email', tokenVersion: 0,
    });

    it('rejects while a code is still fresh', async () => {
      challenge();
      const user = emailUser({ emailOtpCode: hash('112233'), emailOtpExpiresAt: new Date(Date.now() + 290_000) });
      (repoMock.findOne as jest.Mock).mockResolvedValue(user);

      await expect(service.resendEmailMfa('temp')).rejects.toThrow('Please wait');
      expect(emailMock.sendOtpEmail).not.toHaveBeenCalled();
    });

    it('sends a new code after the cooldown', async () => {
      challenge();
      // Issued ~3 minutes ago (TTL 5 minutes) — past the 60s rate limit.
      const user = emailUser({ emailOtpCode: hash('112233'), emailOtpExpiresAt: new Date(Date.now() + 120_000) });
      (repoMock.findOne as jest.Mock).mockResolvedValue(user);

      const res = await service.resendEmailMfa('temp');

      expect(res.emailDelivered).toBe(true);
      expect(emailMock.sendOtpEmail).toHaveBeenCalledTimes(1);
    });
  });

  describe('disableMfa', () => {
    it('clears the email method and pending code', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const user = emailUser({ emailOtpCode: hash('112233'), emailOtpExpiresAt: new Date(Date.now() + 60_000) });
      (repoMock.findOne as jest.Mock).mockResolvedValue(user);

      const res = await service.disableMfa('u1', 'password');

      expect(res).toEqual({ mfaEnabled: false });
      expect(user.mfaMethod).toBeNull();
      expect(user.emailOtpCode).toBeNull();
      expect(user.emailOtpExpiresAt).toBeNull();
    });
  });

  describe('verifyMfaChallenge (TOTP regression)', () => {
    it('rejects TOTP verification for an email-MFA account', async () => {
      (jwtMock.verify as jest.Mock).mockReturnValue({ sub: 'u1', mfaChallenge: true, mfaMethod: 'email', tokenVersion: 0 });
      (repoMock.findOne as jest.Mock).mockResolvedValue(emailUser({ mfaSecret: 'SECRET' }));

      await expect(service.verifyMfaChallenge('temp', '123456')).rejects.toThrow('TOTP is not enabled');
    });
  });
});
