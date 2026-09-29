import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, In, Repository } from 'typeorm';
import { AuditLogService } from '../audit/audit-log.service';
import { TeamScheduleBlock } from './team-schedule-block.entity';

// Canonical block vocabulary (plan constraint): a staff day block is one of
// these five. Stored as varchar(32) and validated here — the same shape as
// CaseStatus (TS enum + service-level validation, no DB CHECK constraint).
export const BLOCK_TYPES: ReadonlySet<string> = new Set([
  'in_office',
  'home_visit',
  'field_day',
  'on_leave',
  'remote',
]);

// Canonical block-visibility vocabulary (plan constraint): a block is visible
// to the whole team by default, or additionally to barangay coordinators.
// Stored as varchar(32) and validated here — the same shape as BLOCK_TYPES.
export const BLOCK_VISIBLE_TO: ReadonlySet<string> = new Set([
  'team',
  'team_coordinators',
]);

export interface TeamBlockInput {
  userId: string;
  blockDate: string;
  blockType: string;
  startTime?: string;
  endTime?: string;
  note?: string;
  visibleTo?: string;
}

// Structural subset of the authenticated user (`req.user`): only the fields
// the schedule rules branch on. Controllers pass `req.user` directly — User
// satisfies this shape.
export interface TeamBlockRequester {
  id: string;
  role: string;
  assignedBarangay?: string | null;
}

@Injectable()
export class TeamScheduleService {
  private readonly logger = new Logger(TeamScheduleService.name);

  constructor(
    @InjectRepository(TeamScheduleBlock)
    private repo: Repository<TeamScheduleBlock>,
    @Optional() private auditLog?: AuditLogService,
  ) {}

  private assertBlockType(blockType: string): void {
    if (!BLOCK_TYPES.has(blockType)) {
      throw new BadRequestException(
        `Unknown block type "${blockType}". Allowed: ${[...BLOCK_TYPES].join(', ')}.`,
      );
    }
  }

  private assertVisibleTo(visibleTo: string): void {
    if (!BLOCK_VISIBLE_TO.has(visibleTo)) {
      throw new BadRequestException(
        `Unknown block visibility "${visibleTo}". Allowed: ${[...BLOCK_VISIBLE_TO].join(', ')}.`,
      );
    }
  }

  private static dayString(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  async listBlocks(
    from: Date,
    to: Date,
    staffId?: string,
    requesterRole?: string,
    requesterBarangay?: string,
  ): Promise<TeamScheduleBlock[]> {
    // Date bounds are inclusive, matching the plan's "dates inclusive
    // server-side" constraint: `block_date BETWEEN $1 AND $2` with
    // YYYY-MM-DD strings.
    const where: FindOptionsWhere<TeamScheduleBlock> = {
      blockDate: Between(TeamScheduleService.dayString(from), TeamScheduleService.dayString(to)),
    };

    if (requesterRole === 'coordinator') {
      // Coordinators are office-homed: they only see blocks of the staff
      // assigned to their own barangay. Resolution goes through the same
      // `user_barangay_assignments` relation `users.assignedBarangay` is
      // assembled from (primary assignment row), the users-side analogue of
      // the dashboard's person_addresses EXISTS filter. A coordinator with no
      // assigned barangay gets an empty list — never the whole office.
      if (!requesterBarangay) return [];
      const rows: Array<{ user_id: string }> = await this.repo.manager.query(
        `SELECT user_id FROM user_barangay_assignments
         WHERE barangay = $1 AND is_primary IS NOT FALSE`,
        [requesterBarangay],
      );
      const ids = rows.map(r => r.user_id);
      if (!ids.length) return [];
      where.userId = In(ids);
      // Coordinator visibility (amendment): only blocks the owner toggled to
      // `team_coordinators` are exposed — team-visible rows stay hidden.
      where.visibleTo = 'team_coordinators';
    } else if (staffId) {
      where.userId = staffId;
    }

    return this.repo.find({ where, order: { blockDate: 'ASC' } });
  }

  async createBlock(dto: TeamBlockInput, requester: TeamBlockRequester): Promise<TeamScheduleBlock> {
    this.assertBlockType(dto.blockType);
    const visibleTo = dto.visibleTo ?? 'team';
    this.assertVisibleTo(visibleTo);
    // OWNER-ONLY (amendment): staff manage their own day; admin enjoys no
    // create-for-others path — the same rule applies to every role.
    if (dto.userId !== requester.id) {
      throw new ForbiddenException('Forbidden: you can only create blocks for yourself.');
    }
    const row = this.repo.create({
      userId: dto.userId,
      blockDate: dto.blockDate,
      blockType: dto.blockType,
      startTime: dto.startTime,
      endTime: dto.endTime,
      note: dto.note,
      visibleTo,
      createdBy: requester.id,
    });
    return this.repo.save(row);
  }

  async updateBlock(
    id: string,
    dto: Partial<TeamBlockInput>,
    requester: TeamBlockRequester,
  ): Promise<TeamScheduleBlock> {
    const block = await this.repo.findOne({ where: { id } });
    if (!block) throw new NotFoundException('Schedule block not found');
    // OWNER-ONLY (amendment): admin enjoys no other-staff write — the same
    // owner rule applies to every role, including admin.
    if (block.userId !== requester.id) {
      throw new ForbiddenException('Forbidden: you can only edit your own blocks.');
    }
    // Ownership lives on `userId`, and the PATCH path applies the raw body via
    // Object.assign — the owner must never be able to MUTATE a block's owner
    // either (no admin-reassign carve-out exists for anyone). Sending the
    // unchanged owner id is a no-op and stays allowed (full-representation
    // clients include it); any other value is an ownership change and is
    // rejected.
    if (dto.userId !== undefined && dto.userId !== block.userId) {
      throw new ForbiddenException('Forbidden: you cannot reassign a block to another staff member.');
    }
    if (dto.blockType !== undefined) this.assertBlockType(dto.blockType);
    if (dto.visibleTo !== undefined) this.assertVisibleTo(dto.visibleTo);
    Object.assign(block, dto);
    return this.repo.save(block);
  }

  async deleteBlock(id: string, requester: TeamBlockRequester, actorId?: string): Promise<{ deleted: boolean }> {
    const block = await this.repo.findOne({ where: { id } });
    if (!block) throw new NotFoundException('Schedule block not found');
    // OWNER-ONLY (amendment): admin enjoys no other-staff write — the same
    // owner rule applies to every role, including admin.
    if (block.userId !== requester.id) {
      throw new ForbiddenException('Forbidden: you can only delete your own blocks.');
    }
    await this.repo.delete(id);
    // Hard delete is audited so removals stay reconstructible (plan: deletes
    // are hard + audit entries via the existing audit logger).
    await this.auditLog?.log('team.block.delete', id, actorId);
    return { deleted: true };
  }
}