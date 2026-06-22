import { PENDING_ESCALATION_DAYS, PENDING_WARNING_DAYS, REVIEW_ESCALATION_DAYS, REVIEW_WARNING_DAYS, APPROVED_ESCALATION_DAYS, APPROVED_WARNING_DAYS, SATURDAY, SUNDAY } from './constants';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Case, CaseStatus } from '../cases/case.entity';
import { Notification } from '../notifications/notification.entity';

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

    const pendingOverdue = await this.caseRepo.find({
      where: { status: CaseStatus.PENDING },
    });
    for (const c of pendingOverdue) {
      const age = this.workingDays(c.createdAt, new Date());
      if (age >= PENDING_ESCALATION_DAYS && c.assignedWorkerId) {
        await this.createAlert(c, 'pending_assessment', 'Coordinator review required — case pending assessment > 3 days');
        escalated++;
      } else if (age >= PENDING_WARNING_DAYS && c.assignedWorkerId) {
        await this.createAlert(c, 'pending_assessment', 'Warning: case pending assessment > 2 days');
        warnings++;
      }
    }

    const reviewOverdue = await this.caseRepo.find({
      where: { status: CaseStatus.IN_REVIEW },
    });
    for (const c of reviewOverdue) {
      const age = this.workingDays(c.createdAt, new Date());
      if (age >= REVIEW_ESCALATION_DAYS) {
        await this.createAlert(c, 'in_review', 'MSWDO Head review required — case in review > 3 days');
        escalated++;
      } else if (age >= REVIEW_WARNING_DAYS) {
        await this.createAlert(c, 'in_review', 'Warning: case in review > 2 days');
        warnings++;
      }
    }

    const approvedOverdue = await this.caseRepo.find({
      where: { status: CaseStatus.APPROVED },
    });
    for (const c of approvedOverdue) {
      const age = this.workingDays(c.createdAt, new Date());
      if (age >= APPROVED_ESCALATION_DAYS) {
        await this.createAlert(c, 'approved', 'Admin attention required — case approved > 3 days without disbursement');
        escalated++;
      } else if (age >= APPROVED_WARNING_DAYS) {
        await this.createAlert(c, 'approved', 'Warning: case approved > 2 days without disbursement');
        warnings++;
      }
    }

    this.logger.log(`SLA check: ${escalated} escalated, ${warnings} warnings`);
    return { escalated, warnings };
  }

  private async createAlert(c: Case, stage: string, message: string) {
    const admins = await this.caseRepo.query(
      `SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE`
    );
    for (const admin of admins) {
      await this.notifRepo.save({
        recipientId: admin.id,
        title: `SLA Escalation: ${c.controlNo}`,
        message: `${message} — Case ${c.controlNo} (${stage})`,
        category: 'sla_escalation',
        referenceId: c.id,
      } as any);
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
