import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { TeamStatus } from './team-status.entity';

// Canonical whereabouts vocabulary (plan constraint): a staff member is in
// one of these six states. Stored as varchar(32) and validated here — the
// same shape as BLOCK_TYPES / VISIBLE_TO / CaseStatus (TS enum +
// service-level validation, no DB CHECK constraint). `offline` is a valid
// manual state alongside the five block types.
export const STATUS_VALUES: ReadonlySet<string> = new Set([
  'in_office',
  'home_visit',
  'field_day',
  'on_leave',
  'remote',
  'offline',
]);

// Canonical status-visibility vocabulary (amendment): a status is visible to
// the whole team by default, or additionally to barangay coordinators.
export const STATUS_VISIBLE_TO: ReadonlySet<string> = new Set([
  'team',
  'team_coordinators',
]);

export interface TeamStatusInput {
  status: string;
  note?: string | null;
  visibleTo?: string;
}

@Injectable()
export class TeamStatusService {
  private readonly logger = new Logger(TeamStatusService.name);

  constructor(
    @InjectRepository(TeamStatus)
    private repo: Repository<TeamStatus>,
    // Task 6's gateway is consumed here: after a successful upsert the new
    // whereabouts is pushed to the shared `team` room (staff + coordinators
    // joined; claimants excluded by the gateway's role-gated membership).
    private gateway: NotificationsGateway,
  ) {}

  private assertStatus(status: string): void {
    if (!STATUS_VALUES.has(status)) {
      throw new BadRequestException(
        `Unknown status "${status}". Allowed: ${[...STATUS_VALUES].join(', ')}.`,
      );
    }
  }

  private assertVisibleTo(visibleTo: string): void {
    if (!STATUS_VISIBLE_TO.has(visibleTo)) {
      throw new BadRequestException(
        `Unknown status visibility "${visibleTo}". Allowed: ${[...STATUS_VISIBLE_TO].join(', ')}.`,
      );
    }
  }

  async getMyStatus(userId: string): Promise<TeamStatus | null> {
    return this.repo.findOne({ where: { userId } });
  }

  async setStatus(userId: string, dto: TeamStatusInput): Promise<TeamStatus> {
    this.assertStatus(dto.status);
    // Default visibility is team-wide; toggling exposes the status to
    // coordinators (amend spec: `team` default | `team_coordinators`).
    const visibleTo = dto.visibleTo ?? 'team';
    this.assertVisibleTo(visibleTo);
    // One active whereabouts row per user: last-write-wins upsert on the
    // UNIQUE user_id (plan edge case 8). `updatedAt` is set explicitly so the
    // ON CONFLICT branch bumps the timestamp too (the column's DEFAULT now()
    // only fires on INSERT) — the broadcast payload and returned row then
    // always reflect the write time.
    await this.repo.upsert(
      { userId, status: dto.status, note: dto.note ?? null, visibleTo, updatedAt: new Date() },
      { conflictPaths: ['userId'] },
    );
    // Refetch so the caller receives the actual persisted row (server-side
    // timestamps, normalized note) rather than an InsertResult.
    const row = await this.repo.findOne({ where: { userId } });
    if (!row) {
      // Cannot happen after a successful upsert; kept to keep the broadcast
      // payload typed on a real row.
      throw new BadRequestException('Status write did not persist.');
    }
    // Broadcast AFTER a successful upsert only (RULING-1): the team room gets
    // the same shape the gateway's `team.status.updated` consumers expect.
    this.gateway.broadcastTeamStatus({
      userId: row.userId,
      status: row.status,
      note: row.note ?? null,
      updatedAt: row.updatedAt.toISOString(),
    });
    return row;
  }

  async listStatuses(requesterRole?: string, requesterBarangay?: string): Promise<TeamStatus[]> {
    // Team status board: most recently updated first. Coordinators are
    // office-homed like the blocks list (amendment): they see only statuses
    // toggled to `team_coordinators`, from the staff of their own barangay —
    // same user_barangay_assignments resolution as blocks; a coordinator with
    // no assigned barangay gets [] — never the whole office.
    const where: FindOptionsWhere<TeamStatus> = {};
    if (requesterRole === 'coordinator') {
      if (!requesterBarangay) return [];
      const rows: Array<{ user_id: string }> = await this.repo.manager.query(
        `SELECT user_id FROM user_barangay_assignments
         WHERE barangay = $1 AND is_primary IS NOT FALSE`,
        [requesterBarangay],
      );
      const ids = rows.map(r => r.user_id);
      if (!ids.length) return [];
      where.userId = In(ids);
      where.visibleTo = 'team_coordinators';
    }
    return this.repo.find({ where, order: { updatedAt: 'DESC' } });
  }
}