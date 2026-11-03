import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OtpService } from './otp.service.js';
import { SmsGatewayService } from './sms-gateway.service.js';
import { PublicConfigController } from './public-config.controller.js';
import { OtpCode } from './otp.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([OtpCode])],
  controllers: [PublicConfigController],
  providers: [OtpService, SmsGatewayService],
  exports: [OtpService, SmsGatewayService],
})
export class OtpModule {}
