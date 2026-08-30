import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { UserToken } from './user-token.entity';
import { UserBarangayAssignment } from './user-barangay-assignment.entity';
import { Person } from '../beneficiaries/person.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { OtpService } from '../otp/otp.service';
import { SmsGatewayService } from '../otp/sms-gateway.service';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let repoMock: Partial<Repository<User>>;
  let tokenRepoMock: Partial<Repository<UserToken>>;
  let barangayRepoMock: Partial<Repository<UserBarangayAssignment>>;
  let jwtMock: Partial<JwtService>;
  let otpMock: Partial<OtpService>;
  let emailMock: { [k: string]: jest.Mock };

  beforeEach(async () => {
    repoMock = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    tokenRepoMock = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    jwtMock = {
      sign: jest.fn().mockReturnValue('signed-token'),
      verify: jest.fn(),
    };
    otpMock = {
      requestOtp: jest.fn().mockResolvedValue({ message: "OTP sent", retryAfter: 30 }),
      verifyOtp: jest.fn(),
    };
    const personRepoMock = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    const benRepoMock = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    barangayRepoMock = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    const smsMock = { sendSms: jest.fn().mockResolvedValue({ success: true, provider: 'log', messageId: 'm1' }) };
    emailMock = {
      sendEmail: jest.fn().mockResolvedValue({ success: true }),
      sendVerificationEmail: jest.fn().mockResolvedValue({ success: true }),
      sendOtpEmail: jest.fn().mockResolvedValue({ success: true }),
      sendForgotPasswordEmail: jest.fn().mockResolvedValue({ success: true }),
      sendEmailChangeVerification: jest.fn().mockResolvedValue({ success: true }),
    };

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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should throw ConflictException if email exists', async () => {
      (repoMock.findOne as jest.Mock).mockResolvedValue({ id: '1', email: 'test@test.com' });
      await expect(service.register({ email: 'test@test.com', password: 'pass' })).rejects.toThrow('Email already registered');
    });

    it('should hash password and save user', async () => {
      (repoMock.findOne as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      const created = { id: 'u1', email: 'test@test.com', password: 'hashed', role: 'social_worker', isActive: true };
      (repoMock.create as jest.Mock).mockReturnValue(created);
      (repoMock.save as jest.Mock).mockResolvedValue(created);
      const result = await service.register({ email: 'test@test.com', password: 'pass' });
      expect(bcrypt.hash).toHaveBeenCalledWith('pass', 12);
      expect(repoMock.create).toHaveBeenCalled();
      expect(repoMock.save).toHaveBeenCalled();
      expect(result).toHaveProperty('message', 'Registration successful. Please check your email to verify your account.');
      expect(emailMock.sendVerificationEmail).toHaveBeenCalledWith('test@test.com', expect.any(String));
    });

    it('should create a primary barangay assignment when assignedBarangay is provided', async () => {
      (repoMock.findOne as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      const created = { id: 'u1', email: 'test@test.com', password: 'hashed', role: 'social_worker', isActive: true };
      (repoMock.create as jest.Mock).mockReturnValue(created);
      (repoMock.save as jest.Mock).mockResolvedValue(created);
      const assignment = { userId: 'u1', barangay: 'Bangkal', isPrimary: true };
      (barangayRepoMock.create as jest.Mock).mockReturnValue(assignment);
      (barangayRepoMock.save as jest.Mock).mockResolvedValue(assignment);
      await service.register({ email: 'test@test.com', password: 'pass', assignedBarangay: 'Bangkal' });
      expect(barangayRepoMock.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', barangay: 'Bangkal', isPrimary: true }));
      expect(barangayRepoMock.save).toHaveBeenCalled();
    });

    it('should not create a barangay assignment when none provided', async () => {
      (repoMock.findOne as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      (repoMock.create as jest.Mock).mockReturnValue({ id: 'u1', email: 'x@x.com', role: 'claimant' });
      (repoMock.save as jest.Mock).mockResolvedValue({});
      await service.register({ email: 'x@x.com', password: 'pass' });
      expect(barangayRepoMock.save).not.toHaveBeenCalled();
    });
  });

  describe('validateUser', () => {
    it('should return null if user not found', async () => {
      (repoMock.findOne as jest.Mock).mockResolvedValue(null);
      const result = await service.validateUser('a@a.com', 'pass');
      expect(result).toBeNull();
    });

    it('should return user if password matches', async () => {
      const user = { id: '1', email: 'a@a.com', password: 'hashed' } as User;
      (repoMock.findOne as jest.Mock).mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const result = await service.validateUser('a@a.com', 'pass');
      expect(result).toEqual(user);
    });

    it('should return null if password invalid', async () => {
      const user = { id: '1', email: 'a@a.com', password: 'hashed' } as User;
      (repoMock.findOne as jest.Mock).mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      const result = await service.validateUser('a@a.com', 'pass');
      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return tokens for non-coordinator without MFA', async () => {
      const user = { id: '1', email: 'a@a.com', role: 'social_worker', fullName: 'Test', emailVerified: true } as User;
      const result = await service.login(user) as { accessToken: string; refreshToken: string; user: any };
      expect(result.accessToken).toBe('signed-token');
      expect(result.refreshToken).toBe('signed-token');
      expect(result.user).toEqual({ id: '1', email: 'a@a.com', role: 'social_worker', fullName: 'Test' });
    });

    it('should issue tokens for coordinator without OTP', async () => {
      const user = { id: '2', email: 'coord@test.com', role: 'coordinator' as any, phone: '+639171234567', fullName: 'Coord', emailVerified: true } as User;
      const result = await service.login(user) as { accessToken: string };
      expect(result.accessToken).toBe('signed-token');
    });

    it('should still respect existing MFA over coordinator', async () => {
      const user = { id: '4', email: 'coord@test.com', role: 'coordinator' as any, phone: '+639171234567', mfaEnabled: true, fullName: 'Coord', emailVerified: true } as User;
      const result = await service.login(user) as { mfaRequired: boolean; tempToken: string };
      expect(result.mfaRequired).toBe(true);
      expect(otpMock.requestOtp).not.toHaveBeenCalled();
    });
  });

  describe('verifySmsOtp', () => {
    it('should issue tokens on valid OTP', async () => {
      (jwtMock.verify as jest.Mock).mockReturnValue({ sub: '1', smsOtpChallenge: true, tokenVersion: 1 });
      (repoMock.findOne as jest.Mock).mockResolvedValue({ id: '1', email: 'a@a.com', role: 'coordinator', phone: '+639171234567' });
      (otpMock.verifyOtp as jest.Mock).mockResolvedValue(true);
      const result = await service.verifySmsOtp('valid-token', '123456') as { accessToken: string; user: any };
      expect(result.accessToken).toBe('signed-token');
      expect(otpMock.verifyOtp).toHaveBeenCalledWith('+639171234567', '123456');
    });

    it('should throw on invalid OTP', async () => {
      (jwtMock.verify as jest.Mock).mockReturnValue({ sub: '1', smsOtpChallenge: true, tokenVersion: 1 });
      (repoMock.findOne as jest.Mock).mockResolvedValue({ id: '1', email: 'a@a.com', role: 'coordinator', phone: '+639171234567' });
      (otpMock.verifyOtp as jest.Mock).mockResolvedValue(false);
      await expect(service.verifySmsOtp('valid-token', '000000')).rejects.toThrow('Invalid or expired OTP');
    });

    it('should throw if tempToken lacks smsOtpChallenge claim', async () => {
      (jwtMock.verify as jest.Mock).mockReturnValue({ sub: '1' });
      await expect(service.verifySmsOtp('bad-token', '123456')).rejects.toThrow('Invalid challenge token');
    });
  });
});
