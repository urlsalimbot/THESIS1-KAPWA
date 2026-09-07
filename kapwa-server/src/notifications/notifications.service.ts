import { DEFAULT_NOTIF_LIMIT } from './constants';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationCategory } from './notification.entity';
import { NotificationPreference } from './notification-preference.entity';
import { SmsGatewayService } from '../otp/sms-gateway.service';
import { renderTemplate, SmsTemplateKey } from './sms-templates';
import { UpdatePreferenceInput } from './dto/notifications.zod';
import { NotificationsGateway } from './notifications.gateway';
import { EmailService } from '../email/email.service';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private notifRepo: Repository<Notification>,
    @InjectRepository(NotificationPreference) private notifPrefRepo: Repository<NotificationPreference>,
    private smsGateway: SmsGatewayService,
    private notifGateway: NotificationsGateway,
    private emailService: EmailService,
  ) {}

  async create(notif: Partial<Notification>) {
    const n = this.notifRepo.create(notif);
    const saved = await this.notifRepo.save(n);
    this.notifGateway.emitToUser(saved.recipientId, 'notification:new', saved);
    return saved;
  }

  async createMany(notifs: Array<Partial<Notification>>): Promise<Notification[]> {
    if (notifs.length === 0) return [];
    const entities = notifs.map(n => this.notifRepo.create(n));
    const saved = await this.notifRepo.save(entities);
    for (const n of saved) {
      this.notifGateway.emitToUser(n.recipientId, 'notification:new', n);
    }
    return saved;
  }

  async send(notifId: string) {
    const notif = await this.notifRepo.findOne({ where: { id: notifId } });
    if (!notif) {
      return { message: 'Notification not found' };
    }

    let sent = false;

    if (notif.channel === 'sms' && notif.phone) {
      const result = await this.smsGateway.sendSms(notif.phone, notif.message);
      sent = result.success;
    } else if (notif.channel === 'email' && notif.email) {
      try {
        await this.emailService.sendNotificationEmail(notif.email, notif.title, notif.message);
        sent = true;
      } catch {
        sent = false;
      }
    }

    await this.notifRepo.update(notifId, { sent, sentAt: sent ? new Date() : undefined });
    return { message: sent ? 'Notification sent' : 'Notification send failed' };
  }

  async sendSmsTemplate(phone: string, templateKey: SmsTemplateKey, vars: Record<string, string>) {
    const body = renderTemplate(templateKey, vars);
    return this.smsGateway.sendSms(phone, body);
  }

  async findByRecipient(recipientId: string) {
    return this.notifRepo.find({
      where: { recipientId },
      order: { createdAt: 'DESC' },
      take: DEFAULT_NOTIF_LIMIT,
    });
  }

  async getByUser(userId: string, limit = DEFAULT_NOTIF_LIMIT) {
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

  // Ownership-scoped: a user may only mark their OWN notifications as read.
  async markAsRead(id: string, recipientId: string) {
    const result = await this.notifRepo.update({ id, recipientId }, { isRead: true });
    if (!result.affected) {
      throw new NotFoundException('Notification not found');
    }
    this.notifGateway.emitToUser(recipientId, 'notification:updated', { id, isRead: true });
    const count = await this.getUnreadCount(recipientId);
    this.notifGateway.emitToUser(recipientId, 'unread:count', { count });
    return { message: 'Marked as read' };
  }

  async markAllAsRead(recipientId: string) {
    await this.notifRepo.update(
      { recipientId, isRead: false },
      { isRead: true },
    );
    this.notifGateway.emitToUser(recipientId, 'notifications:read-all', {});
    const count = await this.getUnreadCount(recipientId);
    this.notifGateway.emitToUser(recipientId, 'unread:count', { count });
    return { message: 'All marked as read' };
  }

  private statusLabel(status: string): string {
    const labels: Record<string, string> = {
      enrolled: 'Enrolled',
      assessed: 'Assessed',
      in_review: 'In Review',
      active: 'Active',
      transitioning: 'Transitioning',
      closed: 'Closed',
    };
    return labels[status] || status;
  }

  async notifyCaseUpdate(recipientId: string, caseRef: string, status: string) {
    return this.create({
      recipientId,
      title: 'Case Update',
      message: `Case ${caseRef} status changed to ${this.statusLabel(status)}`,
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

  async checkConsent(userId: string, channel: string, category: NotificationCategory): Promise<boolean> {
    const pref = await this.notifPrefRepo.findOne({
      where: { userId, channel: channel as any, category },
    });
    return pref ? pref.optedIn : false;
  }

  async sendWithConsent(notifId: string) {
    const notif = await this.notifRepo.findOne({ where: { id: notifId } });
    if (!notif) {
      return { message: 'Notification not found' };
    }

    if (notif.category !== NotificationCategory.SYSTEM) {
      const consented = await this.checkConsent(notif.recipientId, notif.channel, notif.category);
      if (!consented) {
        await this.notifRepo.update(notifId, { sent: false, consentSkipped: true });
        return { message: 'Consent not granted — delivery skipped' };
      }
    }

    let sent = false;
    if (notif.channel === 'sms' && notif.phone) {
      const result = await this.smsGateway.sendSms(notif.phone, notif.message);
      sent = result.success;
    } else if (notif.channel === 'email' && notif.email) {
      try {
        await this.emailService.sendNotificationEmail(notif.email, notif.title, notif.message);
        sent = true;
      } catch {
        sent = false;
      }
    }

    await this.notifRepo.update(notifId, { sent, sentAt: sent ? new Date() : undefined });
    return { message: sent ? 'Notification sent' : 'Notification send failed' };
  }

  async getPreferences(userId: string) {
    return this.notifPrefRepo.find({ where: { userId } });
  }

  async bulkSetPreferences(userId: string, prefs: UpdatePreferenceInput[]) {
    const existing = await this.notifPrefRepo.find({ where: { userId } });
    const byKey = new Map(existing.map(p => [`${p.channel}:${p.category}`, p]));
    const results: NotificationPreference[] = [];
    const toSave: Array<Partial<NotificationPreference>> = [];
    for (const pref of prefs) {
      const key = `${pref.channel}:${pref.category}`;
      const found = byKey.get(key);
      if (found) {
        found.optedIn = pref.optedIn;
        toSave.push(found);
        results.push(found);
      } else {
        const created = this.notifPrefRepo.create({
          userId,
          channel: pref.channel,
          category: pref.category,
          optedIn: pref.optedIn,
        });
        toSave.push(created);
        results.push(created as NotificationPreference);
      }
    }
    if (toSave.length > 0) {
      await this.notifPrefRepo.save(toSave as NotificationPreference[]);
    }
    return results;
  }

  async setPreference(userId: string, body: UpdatePreferenceInput) {
    const existing = await this.notifPrefRepo.findOne({
      where: { userId, channel: body.channel as any, category: body.category },
    });
    if (existing) {
      existing.optedIn = body.optedIn;
      return this.notifPrefRepo.save(existing);
    }
    const pref = this.notifPrefRepo.create({
      userId,
      channel: body.channel,
      category: body.category,
      optedIn: body.optedIn,
    });
    return this.notifPrefRepo.save(pref);
  }

  async delete(id: string) {
    const notif = await this.notifRepo.findOne({ where: { id } });
    await this.notifRepo.delete(id);
    if (notif) {
      this.notifGateway.emitToUser(notif.recipientId, 'notification:deleted', { id });
      const count = await this.getUnreadCount(notif.recipientId);
      this.notifGateway.emitToUser(notif.recipientId, 'unread:count', { count });
    }
    return { message: 'Notification deleted' };
  }
}
