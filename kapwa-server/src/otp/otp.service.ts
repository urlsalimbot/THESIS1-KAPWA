import { OTP_MIN, OTP_RANGE, OTP_EXPIRY_MINUTES, OTP_RATE_LIMIT_SECONDS, SECONDS_PER_MINUTE, MS_PER_SECOND } from './constants';
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { OtpCode } from './otp.entity';
import { SmsGatewayService } from './sms-gateway.service';
import * as crypto from 'crypto';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @InjectRepository(OtpCode)
    private otpRepo: Repository<OtpCode>,
    private smsGateway: SmsGatewayService,
  ) {}

  async requestOtp(phone: string): Promise<{ message: string; retryAfter: number }> {
    await this.otpRepo.delete({ expiresAt: LessThan(new Date()) });

    const recent = await this.otpRepo.findOne({
      where: { phone, verified: false },
      order: { createdAt: 'DESC' },
    });
    if (recent) {
      const elapsed = (Date.now() - recent.createdAt.getTime()) / 1000;
      if (elapsed < OTP_RATE_LIMIT_SECONDS) {
        throw new BadRequestException('Please wait before requesting a new OTP');
      }
    }

    const code = String(Math.floor(OTP_MIN + Math.random() * OTP_RANGE));
    const hashed = crypto.createHash('sha256').update(code).digest('hex');

    await this.otpRepo.save({
      phone,
      code: hashed,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND),
    });

    const smsResult = await this.smsGateway.sendSms(phone, `Your KAPWA OTP is: ${code}. Valid for 5 minutes.`);
    if (!smsResult.success && process.env.NODE_ENV === 'production') {
      throw new BadRequestException('Failed to send SMS. Please try again.');
    }

    return { message: 'OTP sent', retryAfter: OTP_RATE_LIMIT_SECONDS };
  }

  async verifyOtp(phone: string, code: string): Promise<boolean> {
    await this.otpRepo.delete({ expiresAt: LessThan(new Date()) });

    const hashed = crypto.createHash('sha256').update(code).digest('hex');
    const otp = await this.otpRepo.findOne({
      where: { phone, code: hashed, verified: false },
      order: { createdAt: 'DESC' },
    });

    if (!otp) return false;

    await this.otpRepo.update(otp.id, { verified: true });
    return true;
  }
}
