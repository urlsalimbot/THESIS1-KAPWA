import { PENDING_ESCALATION_DAYS, PENDING_WARNING_DAYS, REVIEW_ESCALATION_DAYS, REVIEW_WARNING_DAYS, APPROVED_ESCALATION_DAYS, APPROVED_WARNING_DAYS, SATURDAY, SUNDAY } from '../common/constants';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Case, CaseStatus } from '../cases/case.entity';
import { Notification, NotificationCategory } from '../notifications/notification.entity';

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
      const age = this.workingDays(c.createdAt, new Date());
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
      const age = this.workingDays(c.createdAt, new Date());
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
      const age = this.workingDays(c.createdAt, new Date());
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
    const rows: Notification[] = [];
    for (const a of alerts) {
      for (const admin of admins) {
        rows.push(this.notifRepo.create({
          recipientId: admin.id,
          title: `SLA Escalation: ${a.c.controlNo}`,
          message: `${a.message} — Case ${a.c.controlNo} (${this.statusLabel(a.stage)})`,
          category: NotificationCategory.SLA_ESCALATION,
          referenceId: a.c.id,
        }));
      }
    }
    if (rows.length > 0) {
      await this.notifRepo.save(rows);
    }
  }

  private workingDays(start: Date, end: Date): number {
    let count = 0;
    const current = new Date(start);
    while (current <= end) {
      const day = current.getDay();
      if (day !== SUNDAY && day !== SATURDAY) count++;
      current.setDate(current.getDate() + 1);
    }
    return count;
  }
}
