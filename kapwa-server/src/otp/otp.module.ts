import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OtpService } from './otp.service';
import { SmsGatewayService } from './sms-gateway.service';
import { OtpCode } from './otp.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OtpCode])],
  providers: [OtpService, SmsGatewayService],
  exports: [OtpService, SmsGatewayService],
})
export class OtpModule {}
