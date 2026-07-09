import { DEFAULT_NOTIF_LIMIT } from './constants';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationCategory } from './notification.entity';
import { NotificationPreference } from './notification-preference.entity';
import { SmsGatewayService } from '../otp/sms-gateway.service';
import { renderTemplate, SmsTemplateKey } from './sms-templates';
import { UpdatePreferenceInput } from './dto/notifications.zod';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private notifRepo: Repository<Notification>,
    @InjectRepository(NotificationPreference) private notifPrefRepo: Repository<NotificationPreference>,
    private smsGateway: SmsGatewayService,
  ) {}

  async create(notif: Partial<Notification>) {
    const n = this.notifRepo.create(notif);
    return this.notifRepo.save(n);
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

  private statusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending_assessment: 'Pending Assessment',
      in_review: 'In Review',
      approved: 'Approved',
      disbursed: 'Disbursed',
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
    }

    await this.notifRepo.update(notifId, { sent, sentAt: sent ? new Date() : undefined });
    return { message: sent ? 'Notification sent' : 'Notification send failed' };
  }

  async getPreferences(userId: string) {
    return this.notifPrefRepo.find({ where: { userId } });
  }

  async bulkSetPreferences(userId: string, prefs: UpdatePreferenceInput[]) {
    const results = [];
    for (const pref of prefs) {
      const result = await this.setPreference(userId, pref);
      results.push(result);
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
    await this.notifRepo.delete(id);
    return { message: 'Notification deleted' };
  }
}
