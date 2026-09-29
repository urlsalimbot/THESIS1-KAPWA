import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OtpService } from './otp.service';
import { SmsGatewayService } from './sms-gateway.service';
import { PublicConfigController } from './public-config.controller';
import { OtpCode } from './otp.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OtpCode])],
  controllers: [PublicConfigController],
  providers: [OtpService, SmsGatewayService],
  exports: [OtpService, SmsGatewayService],
})
export class OtpModule {}
