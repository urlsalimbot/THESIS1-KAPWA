import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ContactMessage } from './contact-message.entity';
import { CreateContactMessageInput } from './dto/contact-message.zod';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationCategory, NotificationType } from '../notifications/notification.entity';
import { User } from '../auth/user.entity';

@Injectable()
export class ContactMessagesService {
  constructor(
    @InjectRepository(ContactMessage)
    private readonly repo: Repository<ContactMessage>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notifications: NotificationsService,
  ) {}

  async create(input: CreateContactMessageInput): Promise<ContactMessage> {
    const saved = await this.repo.save(
      this.repo.create({
        name: input.name,
        email: input.email,
        subject: input.subject ?? null,
        message: input.message,
      }),
    );

    // Notify in-app inboxes (admin + social workers) so submissions are never
    // silently dropped, even before an email mailbox exists.
    const staff = await this.userRepo.find({
      where: { role: In(['admin', 'social_worker']), isActive: true },
      select: ['id'],
    });
    if (staff.length > 0) {
      const snippet = input.message.length > 140 ? `${input.message.slice(0, 140)}…` : input.message;
      await this.notifications.createMany(
        staff.map((u) => ({
          recipientId: u.id,
          title: 'New contact message',
          message: `${input.name} (${input.email}): ${snippet}`,
          category: NotificationCategory.SYSTEM,
          channel: NotificationType.IN_APP,
          referenceId: saved.id,
        })),
      );
    }

    return saved;
  }

  async findAll(): Promise<ContactMessage[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async unreadCount(): Promise<number> {
    return this.repo.count({ where: { status: 'new' } });
  }

  async markRead(id: string): Promise<ContactMessage> {
    const message = await this.repo.findOne({ where: { id } });
    if (!message) throw new NotFoundException('Contact message not found');
    message.status = 'read';
    return this.repo.save(message);
  }
}