import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { CaseEvent } from './case-event.entity';
import { Case } from '../cases/case.entity';
import { TeamScheduleSyncService } from '../team/team-schedule-sync.service';
import { AuditLogService } from '../audit/audit-log.service';
import { CreateCaseEventInput, CreateCaseEventSchema, UpdateCaseEventInput, UpdateCaseEventSchema } from './dto/case-events.zod';

export { LEGAL_CATEGORIES } from './case-events.constants';
import { LEGAL_CATEGORIES } from './case-events.constants';

@Injectable()
export class CaseEventsService {
  private readonly logger = new Logger(CaseEventsService.name);

  constructor(
    @InjectRepository(CaseEvent) private readonly events: Repository<CaseEvent>,
    @InjectRepository(Case) private readonly cases: Repository<Case>,
    private readonly sync: TeamScheduleSyncService,
    @Optional() private readonly auditLog?: AuditLogService,
  ) {}

  listForCase(caseId: string): Promise<CaseEvent[]> {
    return this.events.find({ where: { caseId }, order: { eventDate: 'ASC', startTime: 'ASC' } });
  }

  // True when the event belongs on the shared calendar: planned,
  // home visits unconditionally, hearings only when the office attends.
  shouldSync(event: Pick<CaseEvent, 'status' | 'eventType' | 'attended'>): boolean {
    return event.status === 'planned'
      && (event.eventType === 'home_visit' || event.attended === true);
  }

  private async loadCase(caseId: string): Promise<Case> {
    const c = await this.cases.findOne({ where: { id: caseId } });
    if (!c) throw new NotFoundException('Case not found');
    return c;
  }

  private async loadOwnedEvent(caseId: string, eventId: string): Promise<CaseEvent> {
    const e = await this.events.findOne({ where: { id: eventId } });
    if (!e || e.caseId !== caseId) throw new NotFoundException('Case event not found');
    return e;
  }

  private assertLegalGate(eventType: string, caseCategory: string | null | undefined): void {
    if (eventType === 'court_hearing' && !LEGAL_CATEGORIES.has(caseCategory ?? '')) {
      throw new BadRequestException(
        `Court hearings can only be recorded on legal categories (one of: ${[...LEGAL_CATEGORIES].join(', ')}).`,
      );
    }
  }

  async create(caseId: string, input: CreateCaseEventInput, actor: { id: string }): Promise<CaseEvent> {
    const parsed = CreateCaseEventSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(`Invalid case event payload: ${parsed.error.issues.map(i => i.message).join('; ')}`);
    }
    const c = await this.loadCase(caseId);
    this.assertLegalGate(parsed.data.eventType, c.caseCategory);
    const row = this.events.create({
      ...input,
      caseId,
      status: 'planned',
      createdBy: actor.id,
    } as Partial<CaseEvent>);
    const saved = await this.events.save(row);
    if (this.shouldSync(saved)) {
      await this.sync.upsertForEvent(saved, c.assignedWorkerId, c.controlNo);
    }
    await this.auditLog?.log('case.event.create', caseId, actor.id, { eventId: saved.id, eventType: saved.eventType });
    return saved;
  }

  async update(caseId: string, eventId: string, input: UpdateCaseEventInput, actor: { id: string }): Promise<CaseEvent> {
    const parsed = UpdateCaseEventSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(`Invalid case event payload: ${parsed.error.issues.map(i => i.message).join('; ')}`);
    }
    const event = await this.loadOwnedEvent(caseId, eventId);
    Object.assign(event, parsed.data);
    const saved = await this.events.save(event);
    if (saved.status !== 'planned') {
      await this.sync.removeForEvent(saved.id);
    } else if (this.shouldSync(saved)) {
      const c = await this.loadCase(caseId);
      await this.sync.upsertForEvent(saved, c.assignedWorkerId, c.controlNo);
    } else {
      await this.sync.removeForEvent(saved.id);
    }
    await this.auditLog?.log('case.event.update', caseId, actor.id, { eventId: saved.id, status: saved.status });
    return saved;
  }

  async remove(caseId: string, eventId: string, actor: { id: string }): Promise<{ deleted: boolean }> {
    await this.loadOwnedEvent(caseId, eventId);
    await this.sync.removeForEvent(eventId);
    await this.events.delete(eventId);
    await this.auditLog?.log('case.event.delete', caseId, actor.id, { eventId });
    return { deleted: true };
  }

  async countForCase(caseId: string): Promise<number> {
    return this.events.count({ where: { caseId, status: Not('cancelled') } });
  }
}