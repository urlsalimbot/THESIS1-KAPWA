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

export interface TeamBlockInput {
  userId: string;
  blockDate: string;
  blockType: string;
  startTime?: string;
  endTime?: string;
  note?: string;
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
    } else if (staffId) {
      where.userId = staffId;
    }

    return this.repo.find({ where, order: { blockDate: 'ASC' } });
  }

  async createBlock(dto: TeamBlockInput, requester: TeamBlockRequester): Promise<TeamScheduleBlock> {
    this.assertBlockType(dto.blockType);
    // Workers manage their own day; only an admin may book on someone else's
    // behalf.
    if (requester.role !== 'admin' && dto.userId !== requester.id) {
      throw new ForbiddenException('Forbidden: you can only create blocks for yourself.');
    }
    const row = this.repo.create({
      userId: dto.userId,
      blockDate: dto.blockDate,
      blockType: dto.blockType,
      startTime: dto.startTime,
      endTime: dto.endTime,
      note: dto.note,
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
    if (requester.role !== 'admin' && block.userId !== requester.id) {
      throw new ForbiddenException('Forbidden: you can only edit your own blocks.');
    }
    if (dto.blockType !== undefined) this.assertBlockType(dto.blockType);
    Object.assign(block, dto);
    return this.repo.save(block);
  }

  async deleteBlock(id: string, requester: TeamBlockRequester, actorId?: string): Promise<{ deleted: boolean }> {
    const block = await this.repo.findOne({ where: { id } });
    if (!block) throw new NotFoundException('Schedule block not found');
    if (requester.role !== 'admin' && block.userId !== requester.id) {
      throw new ForbiddenException('Forbidden: you can only delete your own blocks.');
    }
    await this.repo.delete(id);
    // Hard delete is audited so removals stay reconstructible (plan: deletes
    // are hard + audit entries via the existing audit logger).
    await this.auditLog?.log('team.block.delete', id, actorId);
    return { deleted: true };
  }
}