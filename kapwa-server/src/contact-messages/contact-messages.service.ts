import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ContactMessage, ContactMessageReply } from './contact-message.entity';
import { CreateContactMessageInput } from './dto/contact-message.zod';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationCategory, NotificationType } from '../notifications/notification.entity';
import { User } from '../auth/user.entity';
import { MailerService } from '../common/mailer.service';

@Injectable()
export class ContactMessagesService {
  constructor(
    @InjectRepository(ContactMessage)
    private readonly repo: Repository<ContactMessage>,
    @InjectRepository(ContactMessageReply)
    private readonly replyRepo: Repository<ContactMessageReply>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notifications: NotificationsService,
    private readonly mailer: MailerService,
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

  async findAll(): Promise<Array<ContactMessage & { replies: Array<ContactMessageReply & { repliedByName: string | null }> }>> {
    const messages = await this.repo.find({ order: { createdAt: 'DESC' } });
    if (messages.length === 0) return [];
    // One read brings every reply for the page, oldest first — the thread reads
    // the way the conversation happened.
    const replies = await this.replyRepo.find({
      where: { messageId: In(messages.map((m) => m.id)) },
      order: { createdAt: 'ASC' },
    });
    const byMessage = new Map<string, Array<ContactMessageReply & { repliedByName: string | null }>>();
    for (const r of replies) {
      const list = byMessage.get(r.messageId) ?? [];
      list.push(r as ContactMessageReply & { repliedByName: string | null });
      byMessage.set(r.messageId, list);
    }
    // Name the staff who replied — the inbox is the office's own record of who
    // answered what.
    const staffIds = [...new Set(replies.map((r) => r.repliedBy).filter(Boolean))] as string[];
    const staff = staffIds.length
      ? await this.userRepo.find({ where: { id: In(staffIds) }, select: ['id', 'firstName', 'middleName', 'lastName'] })
      : [];
    const nameBy = new Map(staff.map((u) => [u.id, [u.firstName, u.middleName, u.lastName].filter(Boolean).join(' ').trim()]));
    return messages.map((m) => ({
      ...m,
      replies: (byMessage.get(m.id) ?? []).map((r) => ({
        ...r,
        repliedByName: r.repliedBy ? (nameBy.get(r.repliedBy) ?? null) : null,
      })),
    }));
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

  /**
   * Reply to a public inquiry: the reply is EMAILED to the address the visitor
   * gave (threaded subject) AND stored under the message, so the staff inbox
   * shows the conversation. Sent first, stored after — a rejected send records
   * nothing. Replying implies reading, so the message is marked read.
   */
  async reply(id: string, content: string, actorId?: string): Promise<ContactMessage> {
    const message = await this.repo.findOne({ where: { id } });
    if (!message) throw new NotFoundException('Contact message not found');

    const subject = message.subject
      ? `Re: ${message.subject}`
      : 'Re: Your inquiry to MSWDO Norzagaray';
    const sent = await this.mailer.sendMail(message.email, subject, content);
    if (!sent) {
      throw new BadRequestException('Could not send the reply email. Please try again.');
    }

    await this.replyRepo.save(
      this.replyRepo.create({
        messageId: message.id,
        content,
        repliedBy: actorId ?? null,
      }),
    );
    message.status = 'read';
    return this.repo.save(message);
  }
}