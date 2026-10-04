import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { CaseEvent } from './case-event.entity';
import { CaseEventReminder } from './case-event-reminder.entity';
import { ReminderSetting } from './reminder-setting.entity';
import { Case } from '../cases/case.entity';
import { User } from '../auth/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationCategory, NotificationType } from '../notifications/notification.entity';

const REMINDER_CHANNELS = ['in_app', 'email'] as const;

/**
 * Chained-reminder dispatcher: every 15 minutes it finds planned, upcoming
 * events whose lead-time window has opened, claims a dedupe row per
 * (event, offset, channel) BEFORE delivering, and only then sends. The claim
 * row makes overlapping ticks safe; a failed email is not retried (in-app is
 * the authoritative channel).
 *
 * No `ScheduleModule.forRoot()` here — the SLA module's registration is
 * discovered app-wide, so a `@Cron` provider in this module is picked up
 * without a second registration.
 */
@Injectable()
export class CaseEventReminderService {
  private readonly logger = new Logger(CaseEventReminderService.name);

  constructor(
    @InjectRepository(CaseEvent) private readonly events: Repository<CaseEvent>,
    @InjectRepository(CaseEventReminder) private readonly ledger: Repository<CaseEventReminder>,
    @InjectRepository(ReminderSetting) private readonly settings: Repository<ReminderSetting>,
    @InjectRepository(Case) private readonly cases: Repository<Case>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly notifications: NotificationsService,
  ) {}

  // Every 15 minutes. The enum in this @nestjs/schedule version has no
  // EVERY_15_MINUTES member, so the expression is spelled out.
  @Cron('0 */15 * * * *', { name: 'case-event-reminders' })
  async handleReminders(): Promise<void> {
    try {
      await this.checkForReminders(new Date());
    } catch (err) {
      // A failed tick must not take the scheduler down; the next tick retries
      // anything not yet claimed.
      this.logger.warn(`Reminder tick failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** Exposed for tests: the cron wrapper is the only thing the scheduler runs. */
  async checkForReminders(now: Date): Promise<{ dispatched: number; skipped: number }> {
    let dispatched = 0;
    let skipped = 0;
    const today = now.toISOString().slice(0, 10);
    // The DB filter is an optimization only — correctness comes from the
    // `eventAt > now` guard below, which also excludes today's past times.
    const candidates = await this.events.find({
      where: { status: 'planned', eventDate: MoreThanOrEqual(today) },
    });

    for (const event of candidates) {
      // Guarded here as well as in the query: the row is the authority, and a
      // test that feeds the loop directly must not dispatch a closed event.
      if (event.status !== 'planned') {
        skipped++;
        continue;
      }
      // Hearings only remind when the office attends; visits always do.
      if (event.eventType === 'court_hearing' && event.attended !== true) {
        skipped++;
        continue;
      }
      const c = await this.cases.findOne({ where: { id: event.caseId } });
      if (!c?.assignedWorkerId) {
        skipped++;
        continue;
      }
      const eventAt = this.eventDateTime(event);
      if (eventAt.getTime() <= now.getTime()) {
        skipped++;
        continue;
      }
      const category = event.eventType === 'court_hearing'
        ? NotificationCategory.COURT_HEARING
        : NotificationCategory.HOME_VISIT;
      const offsets = await this.resolveOffsets(event.eventType, c.assignedWorkerId);
      for (const offset of offsets) {
        const remindAt = new Date(eventAt.getTime() - offset * 60_000);
        if (remindAt.getTime() > now.getTime()) continue; // not yet due
        for (const channel of REMINDER_CHANNELS) {
          const claimed = await this.ledger.findOne({
            where: { eventId: event.id, offsetMinutes: offset, channel },
          });
          if (claimed) continue;
          // A channel that cannot deliver must not burn its claim row: resolve
          // the email target (consent + address) before claiming.
          const emailTo = channel === 'email'
            ? await this.emailTarget(c.assignedWorkerId, category)
            : null;
          if (channel === 'email' && !emailTo) continue;
          // Claim BEFORE delivery: two overlapping ticks cannot both send.
          await this.ledger.insert({ eventId: event.id, offsetMinutes: offset, channel });
          const ok = channel === 'in_app'
            ? await this.deliverInApp(event, c.controlNo, c.assignedWorkerId, category)
            : await this.deliverEmail(event, c.controlNo, emailTo as string);
          if (ok) {
            const row = await this.ledger.findOne({
              where: { eventId: event.id, offsetMinutes: offset, channel },
            });
            if (row) await this.ledger.update(row.id, { sentAt: new Date() });
          }
          dispatched++;
        }
      }
    }
    return { dispatched, skipped };
  }

  /** Event date + optional start time, in server-local time. */
  private eventDateTime(event: CaseEvent): Date {
    const time = event.startTime ? String(event.startTime).slice(0, 5) : '00:00';
    const d = new Date(`${event.eventDate}T${time}:00`);
    return Number.isNaN(d.getTime()) ? new Date(`${event.eventDate}T00:00:00`) : d;
  }

  /**
   * Worker override row wins; otherwise the system default. Absent rows for
   * either scope mean zero offsets (no reminders), never a crash — and an
   * explicit empty array is a deliberate "no reminders".
   */
  async resolveOffsets(eventType: string, workerId: string): Promise<number[]> {
    const worker = await this.settings.findOne({ where: { scope: 'worker', userId: workerId, eventType } });
    if (worker) return Array.isArray(worker.offsets) ? worker.offsets : [];
    const system = await this.settings.findOne({ where: { scope: 'system', eventType } });
    return system && Array.isArray(system.offsets) ? system.offsets : [];
  }

  private reminderCopy(event: CaseEvent, controlNo: string): { title: string; message: string } {
    const label = event.eventType === 'court_hearing' ? 'Court hearing' : 'Home visit';
    const when = `${event.eventDate}${event.startTime ? ` ${String(event.startTime).slice(0, 5)}` : ''}`;
    const where = event.venue ? ` at ${event.venue}` : '';
    return {
      title: `Reminder: ${label} — ${controlNo}`,
      message: `Case ${controlNo}: ${label} on ${when}${where}.${event.notes ? ` ${event.notes}` : ''}`,
    };
  }

  private async deliverInApp(
    event: CaseEvent, controlNo: string, workerId: string, category: NotificationCategory,
  ): Promise<boolean> {
    const { title, message } = this.reminderCopy(event, controlNo);
    await this.notifications.create({
      recipientId: workerId,
      title,
      message,
      category,
      // The case id, so the client links to the case the event belongs to.
      referenceId: event.caseId,
    });
    return true;
  }

  /**
   * The address to email, or null when the channel is unavailable. Consent is
   * default-on for the two reminder categories (absent preference row = opted
   * in); an inactive worker or missing address disables the channel.
   */
  private async emailTarget(workerId: string, category: NotificationCategory): Promise<string | null> {
    if (!(await this.notifications.checkConsent(workerId, NotificationType.EMAIL, category))) return null;
    const user = await this.users.findOne({ where: { id: workerId, isActive: true } });
    return user?.email ?? null;
  }

  private async deliverEmail(event: CaseEvent, controlNo: string, to: string): Promise<boolean> {
    const { title, message } = this.reminderCopy(event, controlNo);
    try {
      return await this.notifications.sendEmailDirect(to, title, message);
    } catch {
      this.logger.warn(`Reminder email failed for event ${event.id}`);
      return false;
    }
  }
}