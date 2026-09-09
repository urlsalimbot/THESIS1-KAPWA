import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactMessage } from './contact-message.entity';
import { ContactMessagesService } from './contact-messages.service';
import { ContactMessagesPublicController } from './contact-messages-public.controller';
import { ContactMessagesController } from './contact-messages.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { User } from '../auth/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ContactMessage, User]), NotificationsModule],
  controllers: [ContactMessagesPublicController, ContactMessagesController],
  providers: [ContactMessagesService],
})
export class ContactMessagesModule {}