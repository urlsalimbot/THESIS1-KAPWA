import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationCategory } from './notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private notifRepo: Repository<Notification>
  ) {}

  async create(notif: Partial<Notification>) {
    const n = this.notifRepo.create(notif);
    return this.notifRepo.save(n);
  }

  async send(notifId: string) {
    await this.notifRepo.update(notifId, { sent: true, sentAt: new Date() });
    return { message: 'Notification sent' };
  }

  async findByRecipient(recipientId: string) {
    return this.notifRepo.find({
      where: { recipientId },
      order: { createdAt: 'DESC' },
    });
  }

  async getByUser(userId: string, limit = 20) {
    return this.notifRepo.find({
      where: { recipientId: userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getUnreadCount(recipientId: string) {
    return this.notifRepo.count({
      where: { recipientId, isRead: false },
    });
  }

  async markAsRead(id: string) {
    await this.notifRepo.update(id, { isRead: true });
    return { message: 'Marked as read' };
  }

  async markAllAsRead(recipientId: string) {
    await this.notifRepo.update(
      { recipientId, isRead: false },
      { isRead: true },
    );
    return { message: 'All marked as read' };
  }

  async notifyCaseUpdate(recipientId: string, caseRef: string, status: string) {
    return this.create({
      recipientId,
      title: 'Case Update',
      message: `Case ${caseRef} status changed to ${status}`,
      category: NotificationCategory.CASE_UPDATE,
      referenceId: caseRef,
    });
  }

  async notifySyncConflict(recipientId: string, tableName: string, reason: string) {
    return this.create({
      recipientId,
      title: 'Sync Conflict',
      message: `Conflict on ${tableName}: ${reason}`,
      category: NotificationCategory.SYNC_CONFLICT,
    });
  }

  async delete(id: string) {
    await this.notifRepo.delete(id);
    return { message: 'Notification deleted' };
  }
}
