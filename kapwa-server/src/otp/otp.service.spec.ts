import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OtpService } from './otp.service';
import { OtpCode } from './otp.entity';
import { SmsGatewayService } from './sms-gateway.service';

describe('OtpService', () => {
  let service: OtpService;
  let repoMock: any;
  let smsMock: any;

  beforeEach(async () => {
    repoMock = {
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
      findOne: jest.fn(),
      save: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    smsMock = { sendSms: jest.fn().mockResolvedValue(true) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        { provide: getRepositoryToken(OtpCode), useValue: repoMock },
        { provide: SmsGatewayService, useValue: smsMock },
      ],
    }).compile();
    service = module.get<OtpService>(OtpService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('requestOtp', () => {
    it('sends OTP and returns message when no recent code', async () => {
      repoMock.findOne.mockResolvedValue(null);
      const result = await service.requestOtp('+639123456789');
      expect(result.message).toBe('OTP sent');
      expect(smsMock.sendSms).toHaveBeenCalled();
      expect(repoMock.save).toHaveBeenCalled();
    });

    it('throws BadRequestException when rate limited', async () => {
      repoMock.findOne.mockResolvedValue({ createdAt: new Date() });
      await expect(service.requestOtp('+639123456789')).rejects.toThrow('Please wait');
    });
  });

  describe('verifyOtp', () => {
    it('verifies a valid OTP and marks as verified', async () => {
      repoMock.findOne.mockResolvedValue({ id: '1', phone: '+639123456789', code: 'hash', verified: false });
      const result = await service.verifyOtp('+639123456789', '123456');
      expect(result).toBe(true);
      expect(repoMock.update).toHaveBeenCalledWith('1', { verified: true });
    });

    it('returns false for invalid OTP', async () => {
      repoMock.findOne.mockResolvedValue(null);
      const result = await service.verifyOtp('+639123456789', 'wrong');
      expect(result).toBe(false);
    });
  });
});
