import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { RequestOtpSchema, VerifyOtpSchema } from './dto/otp.zod';
import { OtpService } from './otp.service';

@ApiTags('OTP')
@Controller('otp')
export class OtpController {
  constructor(private otpService: OtpService) {}

  @Post('request')
  @HttpCode(200)
  @ApiOperation({ summary: 'Request OTP code via SMS' })
  async requestOtp(@Body(new ZodPipe(RequestOtpSchema)) body: { phone: string }) {
    return this.otpService.requestOtp(body.phone);
  }

  @Post('verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify OTP code' })
  async verifyOtp(@Body(new ZodPipe(VerifyOtpSchema)) body: { phone: string; code: string }) {
    const valid = await this.otpService.verifyOtp(body.phone, body.code);
    return { verified: valid };
  }
}
