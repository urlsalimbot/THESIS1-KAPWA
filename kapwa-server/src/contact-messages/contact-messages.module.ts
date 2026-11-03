import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactMessage, ContactMessageReply } from './contact-message.entity.js';
import { ContactMessagesService } from './contact-messages.service.js';
import { ContactMessagesPublicController } from './contact-messages-public.controller.js';
import { ContactMessagesController } from './contact-messages.controller.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { User } from '../auth/user.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([ContactMessage, ContactMessageReply, User]), NotificationsModule],
  controllers: [ContactMessagesPublicController, ContactMessagesController],
  providers: [ContactMessagesService],
})
export class ContactMessagesModule {}