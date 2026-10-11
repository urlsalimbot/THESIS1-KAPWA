import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Case, CaseStatus } from '../cases/case.entity';
import { Notification, NotificationCategory } from '../notifications/notification.entity';
import { caseStatusLabel } from '../common/status-labels';
import { workingDaysBetween } from '../common/utils';
import { PENDING_ESCALATION_DAYS, PENDING_WARNING_DAYS, REVIEW_ESCALATION_DAYS, REVIEW_WARNING_DAYS, APPROVED_ESCALATION_DAYS, APPROVED_WARNING_DAYS } from '../common/constants';

@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name);

  constructor(
    @InjectRepository(Case)
    private caseRepo: Repository<Case>,
    @InjectRepository(Notification)
    private notifRepo: Repository<Notification>,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES, { name: 'sla-escalation' })
  async handleSlaCheck() {
    this.logger.log('SLA escalation check triggered');
    await this.checkAndEscalate();
  }

  async checkAndEscalate(): Promise<{ escalated: number; warnings: number }> {
    let escalated = 0;
    let warnings = 0;
    const alerts: Array<{ c: Case; stage: string; message: string }> = [];

    const pendingOverdue = await this.caseRepo.find({
      where: { status: CaseStatus.ENROLLED },
    });
    for (const c of pendingOverdue) {
      const age = workingDaysBetween(c.createdAt, new Date());
      if (age >= PENDING_ESCALATION_DAYS && c.assignedWorkerId) {
        this.stageAlert(alerts, c, 'pending_assessment', 'Coordinator review required — case pending assessment > 3 days');
        escalated++;
      } else if (age >= PENDING_WARNING_DAYS && c.assignedWorkerId) {
        this.stageAlert(alerts, c, 'pending_assessment', 'Warning: case pending assessment > 2 days');
        warnings++;
      }
    }

    const reviewOverdue = await this.caseRepo.find({
      where: { status: CaseStatus.IN_REVIEW },
    });
    for (const c of reviewOverdue) {
      const age = workingDaysBetween(c.createdAt, new Date());
      if (age >= REVIEW_ESCALATION_DAYS) {
        this.stageAlert(alerts, c, 'in_review', 'MSWDO Head review required — case in review > 3 days');
        escalated++;
      } else if (age >= REVIEW_WARNING_DAYS) {
        this.stageAlert(alerts, c, 'in_review', 'Warning: case in review > 2 days');
        warnings++;
      }
    }

    // ACTIVE cases: the program `waiting_period_days` column was dropped in
    // migration 0081, so the thresholds are the global APPROVED_* constants.
    // (The old raw query over that column would throw on every tick once an
    // ACTIVE case existed.)
    const activeOverdue = await this.caseRepo.find({
      where: { status: CaseStatus.ACTIVE },
    });
    for (const c of activeOverdue) {
      const age = workingDaysBetween(c.createdAt, new Date());
      if (age >= APPROVED_ESCALATION_DAYS) {
        this.stageAlert(alerts, c, 'active', `Admin attention required — case active > ${APPROVED_ESCALATION_DAYS} days without transition`);
        escalated++;
      } else if (age >= APPROVED_WARNING_DAYS) {
        this.stageAlert(alerts, c, 'active', `Warning: case active > ${APPROVED_WARNING_DAYS} days without transition`);
        warnings++;
      }
    }

    if (alerts.length > 0) {
      await this.bulkCreateAlerts(alerts);
    }

    this.logger.log(`SLA check: ${escalated} escalated, ${warnings} warnings`);
    return { escalated, warnings };
  }

  private stageAlert(
    alerts: Array<{ c: Case; stage: string; message: string }>,
    c: Case,
    stage: string,
    message: string,
  ) {
    alerts.push({ c, stage, message });
  }

  private async bulkCreateAlerts(alerts: Array<{ c: Case; stage: string; message: string }>) {
    const admins = await this.caseRepo.query(
      `SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE`,
    );
    // One SLA notification per case per admin, ever. Without this the 30-minute
    // tick re-inserted the same alert for as long as the case stayed overdue —
    // 48 repeats a day per case per admin, and the inbox unreadable.
    // ceiling: a DELETED notification is re-created on the next tick (there is
    // no "already escalated" flag on the case); upgrade path: add
    // `sla_escalated_at` to cases and set it here.
    const caseIds = [...new Set(alerts.map((a) => a.c.id))];
    const alreadySent = caseIds.length
      ? await this.notifRepo.find({
          where: { referenceId: In(caseIds), category: NotificationCategory.SLA_ESCALATION },
          select: ['referenceId', 'recipientId'],
        })
      : [];
    const sent = new Set(alreadySent.map((n) => `${n.referenceId}:${n.recipientId}`));

    const rows: Notification[] = [];
    for (const a of alerts) {
      for (const admin of admins) {
        if (sent.has(`${a.c.id}:${admin.id}`)) continue;
        rows.push(this.notifRepo.create({
          recipientId: admin.id,
          title: `SLA Escalation: ${a.c.controlNo}`,
          message: `${a.message} — Case ${a.c.controlNo} (${caseStatusLabel(a.stage)})`,
          category: NotificationCategory.SLA_ESCALATION,
          referenceId: a.c.id,
        }));
      }
    }
    if (rows.length > 0) {
      await this.notifRepo.save(rows);
    }
  }

}
