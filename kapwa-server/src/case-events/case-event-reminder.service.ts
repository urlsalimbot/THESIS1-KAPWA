import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { CaseEvent } from './case-event.entity';
import { CaseEventReminder } from './case-event-reminder.entity';
import { Case } from '../cases/case.entity';
import { CaseFollowUpVisit } from '../cases/case-follow-up-visit.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { BeneficiaryClaimant } from '../beneficiaries/beneficiary-claimant.entity';
import { User, UserRole } from '../auth/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { ReminderSettingsService } from './reminder-settings.service';
import { NotificationCategory, NotificationType } from '../notifications/notification.entity';

const REMINDER_CHANNELS = ['in_app', 'email'] as const;

interface ReminderCopy {
  title: string;
  message: string;
}

/**
 * Chained-reminder dispatcher: every 15 minutes it finds planned, upcoming
 * events whose lead-time window has opened, claims a dedupe row per
 * (event, offset, channel) BEFORE delivering, and only then sends. The claim
 * row makes overlapping ticks safe; a failed email is not retried (in-app is
 * the authoritative channel).
 *
 * Two recipient groups share one claim per offset/channel: the assigned worker
 * (the original audience) and the client account(s) linked to the case's
 * beneficiary. Follow-up visits recorded in the transition plan carry no event
 * row, so they are dispatched from `case_follow_up_visits` to the client only —
 * the worker recorded them, the client is the one who needs the heads-up.
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
    private readonly reminderSettings: ReminderSettingsService,
    @InjectRepository(Case) private readonly cases: Repository<Case>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Beneficiary) private readonly beneficiaries: Repository<Beneficiary>,
    @InjectRepository(BeneficiaryClaimant) private readonly claimants: Repository<BeneficiaryClaimant>,
    @InjectRepository(CaseFollowUpVisit) private readonly followUps: Repository<CaseFollowUpVisit>,
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
      dispatched += await this.dispatch({
        claim: { eventId: event.id },
        caseId: event.caseId,
        eventAt,
        now,
        category,
        offsets: await this.resolveOffsets(event.eventType, c.assignedWorkerId),
        copy: this.reminderCopy(event, c.controlNo),
        workerId: c.assignedWorkerId,
        clients: await this.clientUsers(c),
      });
    }

    // Follow-up visits from the Phase-Out plan: an upcoming one reminds the
    // client at the home-visit lead times. No worker reminder — they recorded
    // the visit, and it now also shows on their calendar.
    const visits = await this.followUps.find({ where: { visitDate: MoreThanOrEqual(today) } });
    for (const visit of visits) {
      const eventAt = new Date(`${visit.visitDate}T00:00:00`);
      const c = await this.cases.findOne({ where: { id: visit.caseId } });
      const clients = c ? await this.clientUsers(c) : [];
      if (Number.isNaN(eventAt.getTime()) || eventAt.getTime() <= now.getTime() || !c || clients.length === 0) {
        skipped++;
        continue;
      }
      dispatched += await this.dispatch({
        // Visit rows are regenerated on every plan save, so the claim key is
        // the stable natural key rather than the row id.
        claim: { visitKey: this.visitKey(visit) },
        caseId: visit.caseId,
        eventAt,
        now,
        category: NotificationCategory.HOME_VISIT,
        // A visit has no event type of its own; the home-visit lead times are
        // the closest rule and keep one vocabulary for "staff goes to the home".
        offsets: await this.resolveOffsets('home_visit', c.assignedWorkerId ?? ''),
        copy: this.followUpCopy(visit, c.controlNo),
        clients,
      });
    }
    return { dispatched, skipped };
  }

  /**
   * One (event/visit, offset, channel) delivery pass: claim first, then send to
   * every recipient under that single claim. Returns how many claims were made.
   */
  private async dispatch(opts: {
    claim: { eventId?: string; visitKey?: string };
    caseId: string;
    eventAt: Date;
    now: Date;
    category: NotificationCategory;
    offsets: number[];
    copy: ReminderCopy;
    workerId?: string | null;
    clients: User[];
  }): Promise<number> {
    // Exactly one of the two keys is set — event claims FK to case_events,
    // visit claims are the stable text key.
    const claimWhere = opts.claim.eventId
      ? { eventId: opts.claim.eventId }
      : { visitKey: opts.claim.visitKey };
    let dispatched = 0;
    for (const offset of opts.offsets) {
      const remindAt = new Date(opts.eventAt.getTime() - offset * 60_000);
      if (remindAt.getTime() > opts.now.getTime()) continue; // not yet due
      for (const channel of REMINDER_CHANNELS) {
        const claimed = await this.ledger.findOne({
          where: { ...claimWhere, offsetMinutes: offset, channel },
        });
        if (claimed) continue;
        // A channel that cannot deliver must not burn its claim row: resolve
        // the targets (consent + address) before claiming.
        const workerEmail = channel === 'email' && opts.workerId
          ? await this.emailTarget(opts.workerId, opts.category)
          : null;
        const clientEmails = channel === 'email'
          ? await this.clientEmailTargets(opts.clients, opts.category)
          : [];
        if (channel === 'email' && !workerEmail && clientEmails.length === 0) continue;
        // Claim BEFORE delivery: two overlapping ticks cannot both send.
        await this.ledger.insert({ ...claimWhere, offsetMinutes: offset, channel });
        const ok = channel === 'in_app'
          ? await this.deliverInApp(opts.copy, opts.caseId, opts.category, opts.workerId, opts.clients)
          : await this.deliverEmail(opts.copy, workerEmail, clientEmails);
        if (ok) {
          const row = await this.ledger.findOne({
            where: { ...claimWhere, offsetMinutes: offset, channel },
          });
          if (row) await this.ledger.update(row.id, { sentAt: new Date() });
        }
        dispatched++;
      }
    }
    return dispatched;
  }

  /** Stable dedupe key for a visit reminder claim. */
  private visitKey(visit: CaseFollowUpVisit): string {
    return `${visit.caseId}|${visit.visitDate}|${visit.visitType}`;
  }

  /** Event date + optional start time, in server-local time. */
  private eventDateTime(event: CaseEvent): Date {
    const time = event.startTime ? String(event.startTime).slice(0, 5) : '00:00';
    const d = new Date(`${event.eventDate}T${time}:00`);
    return Number.isNaN(d.getTime()) ? new Date(`${event.eventDate}T00:00:00`) : d;
  }

  /**
   * The offsets in force for this worker + event type. Delegated to
   * `ReminderSettingsService` so the dispatcher and the settings API share one
   * resolution rule (worker override → system default → none).
   */
  resolveOffsets(eventType: string, workerId: string): Promise<number[]> {
    return this.reminderSettings.resolveOffsets(eventType, workerId);
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

  /** Copy for a transition-plan follow-up visit (no venue/time on the row). */
  private followUpCopy(visit: CaseFollowUpVisit, controlNo: string): ReminderCopy {
    return {
      title: `Reminder: Follow-up visit — ${controlNo}`,
      message: `Case ${controlNo}: Follow-up visit (${visit.visitType}) on ${visit.visitDate}.`,
    };
  }

  /**
   * The client-side users of a case: the claimant accounts tied to the
   * beneficiary person (a self-claiming beneficiary) or to their primary
   * representative in `beneficiary_claimants`.
   */
  private async clientUsers(c: Case): Promise<User[]> {
    if (!c.beneficiaryId) return [];
    const ben = await this.beneficiaries.findOne({
      where: { id: c.beneficiaryId },
      select: ['id', 'personId'],
    });
    if (!ben?.personId) return [];
    const reps = await this.claimants.find({
      where: { beneficiaryId: ben.personId, isPrimary: true },
    });
    const personIds = [ben.personId, ...reps.map(r => r.claimantId)];
    return this.users.find({
      where: { role: UserRole.CLAIMANT, isActive: true, personId: In(personIds) },
    });
  }

  private async deliverInApp(
    copy: ReminderCopy, caseId: string, category: NotificationCategory,
    workerId: string | null | undefined, clients: User[],
  ): Promise<boolean> {
    const recipients = workerId ? [workerId, ...clients.map(u => u.id)] : clients.map(u => u.id);
    for (const recipientId of recipients) {
      await this.notifications.create({
        recipientId,
        title: copy.title,
        message: copy.message,
        category,
        // The case id, so the client links to the case the event belongs to.
        referenceId: caseId,
      });
    }
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

  /** Client addresses that consented to this category's email (default-on). */
  private async clientEmailTargets(clients: User[], category: NotificationCategory): Promise<string[]> {
    const targets: string[] = [];
    for (const client of clients) {
      if (!client.email) continue;
      if (await this.notifications.checkConsent(client.id, NotificationType.EMAIL, category)) {
        targets.push(client.email);
      }
    }
    return targets;
  }

  private async deliverEmail(copy: ReminderCopy, workerTo: string | null, clientTos: string[]): Promise<boolean> {
    try {
      if (workerTo) await this.notifications.sendEmailDirect(workerTo, copy.title, copy.message);
      for (const to of clientTos) await this.notifications.sendEmailDirect(to, copy.title, copy.message);
      return true;
    } catch {
      this.logger.warn(`Reminder email failed: ${copy.title}`);
      return false;
    }
  }
}