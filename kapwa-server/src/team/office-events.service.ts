import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { AuditLogService } from '../audit/audit-log.service';
import { OfficeEvent } from './office-event.entity';

// Canonical office-event visibility vocabulary (plan constraint): an event
// is visible to ordinary staff, or to staff + coordinators. Stored as
// varchar(32) and validated here — the same shape as BLOCK_TYPES /
// CaseStatus (TS enum + service-level validation, no DB CHECK constraint).
export const VISIBLE_TO: ReadonlySet<string> = new Set([
  'staff',
  'staff_coordinators',
]);

export interface OfficeEventInput {
  title: string;
  startsAt: string | Date;
  endsAt: string | Date;
  repeatRule?: Record<string, unknown>;
  visibleTo: string;
  location?: string;
  notes?: string;
}

// Structural subset of the authenticated user (`req.user`): only the fields
// the event rules branch on. Controllers pass `req.user` directly — User
// satisfies this shape.
export interface OfficeEventRequester {
  id: string;
  role: string;
}

@Injectable()
export class OfficeEventsService {
  private readonly logger = new Logger(OfficeEventsService.name);

  constructor(
    @InjectRepository(OfficeEvent)
    private repo: Repository<OfficeEvent>,
    @Optional() private auditLog?: AuditLogService,
  ) {}

  private assertVisibleTo(visibleTo: string): void {
    if (!VISIBLE_TO.has(visibleTo)) {
      throw new BadRequestException(
        `Unknown event visibility "${visibleTo}". Allowed: ${[...VISIBLE_TO].join(', ')}.`,
      );
    }
  }

  private static parseTime(v: string | Date): Date {
    if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException(`Invalid event timestamp "${String(v)}".`);
    }
    return d;
  }

  private static assertOrdered(startsAt: Date, endsAt: Date): void {
    if (startsAt > endsAt) {
      throw new BadRequestException('Event end must be after start');
    }
  }

  async listEvents(
    from: Date,
    to: Date,
    requesterRole?: string,
    // Events are not barangay-scoped (unlike staff blocks); the parameter is
    // kept for interface parity with the schedule service and future scoping.
    _requesterBarangay?: string,
  ): Promise<OfficeEvent[]> {
    // Overlap predicate (inclusive bounds): an event is returned when its
    // range intersects the window — `starts_at <= to AND ends_at >= from`.
    // Events spanning the window but starting before `from` still appear so
    // the client can render continuation chips across the boundary (spec:
    // events show on EACH day of their range).
    const where: FindOptionsWhere<OfficeEvent> = {
      startsAt: LessThanOrEqual(to),
      endsAt: MoreThanOrEqual(from),
    };

    if (requesterRole === 'coordinator') {
      // Coordinators are office readers: they only see events explicitly
      // scoped to them; the staff-visible default stays hidden from
      // coordinators per the plan. Read-only — enforced in the controller.
      where.visibleTo = 'staff_coordinators';
    }

    return this.repo.find({ where, order: { startsAt: 'ASC' } });
  }

  async createEvent(dto: OfficeEventInput, requester: OfficeEventRequester): Promise<OfficeEvent> {
    this.assertVisibleTo(dto.visibleTo);
    const startsAt = OfficeEventsService.parseTime(dto.startsAt);
    const endsAt = OfficeEventsService.parseTime(dto.endsAt);
    OfficeEventsService.assertOrdered(startsAt, endsAt);

    // Events are always owned by the creator (plan: owner = requester);
    // repeat_rule is a jsonb passthrough — expanded client-side in v1.
    const row = this.repo.create({
      title: dto.title,
      startsAt,
      endsAt,
      repeatRule: dto.repeatRule,
      visibleTo: dto.visibleTo,
      location: dto.location,
      notes: dto.notes,
      ownerId: requester.id,
    });
    return this.repo.save(row);
  }

  async updateEvent(
    id: string,
    dto: Partial<OfficeEventInput>,
    requester: OfficeEventRequester,
  ): Promise<OfficeEvent> {
    const event = await this.repo.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Office event not found');
    if (requester.role !== 'admin' && event.ownerId !== requester.id) {
      throw new ForbiddenException('Forbidden: you can only edit your own events.');
    }

    if (dto.visibleTo !== undefined) this.assertVisibleTo(dto.visibleTo);
    if (dto.startsAt !== undefined || dto.endsAt !== undefined) {
      const startsAt =
        dto.startsAt !== undefined ? OfficeEventsService.parseTime(dto.startsAt) : event.startsAt;
      const endsAt =
        dto.endsAt !== undefined ? OfficeEventsService.parseTime(dto.endsAt) : event.endsAt;
      OfficeEventsService.assertOrdered(startsAt, endsAt);
      if (dto.startsAt !== undefined) event.startsAt = startsAt;
      if (dto.endsAt !== undefined) event.endsAt = endsAt;
    }
    if (dto.title !== undefined) event.title = dto.title;
    if (dto.repeatRule !== undefined) event.repeatRule = dto.repeatRule;
    if (dto.location !== undefined) event.location = dto.location;
    if (dto.notes !== undefined) event.notes = dto.notes;

    return this.repo.save(event);
  }

  async deleteEvent(
    id: string,
    requester: OfficeEventRequester,
    actorId?: string,
  ): Promise<{ deleted: boolean }> {
    const event = await this.repo.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Office event not found');
    if (requester.role !== 'admin' && event.ownerId !== requester.id) {
      throw new ForbiddenException('Forbidden: you can only delete your own events.');
    }
    await this.repo.delete(id);
    // Hard delete is audited so removals stay reconstructible (plan: deletes
    // are hard + audit entries via the existing audit logger).
    await this.auditLog?.log('team.event.delete', id, actorId);
    return { deleted: true };
  }
}