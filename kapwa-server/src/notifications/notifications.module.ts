import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsService } from './notifications.service.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsGateway } from './notifications.gateway.js';
import { Notification } from './notification.entity.js';
import { NotificationPreference } from './notification-preference.entity.js';
import { OtpModule } from '../otp/otp.module.js';
import { EmailModule } from '../email/email.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, NotificationPreference]),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
    }),
    OtpModule,
    EmailModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway],
  // The gateway is exported so the team module can push whereabouts
  // broadcasts (team.status.updated) after status upserts.
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
