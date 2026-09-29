import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeamInvite } from './team-invite.entity';
import { TeamScheduleBlock } from './team-schedule-block.entity';
import { BLOCK_TYPES } from './team-schedule.service';

// Staff roles allowed to send/receive schedule invites (role matrix:
// coordinator is read-only on the workspace; claimant has no access — both
// are excluded here; enforcement lives in the controller @Roles too).
export const INVITE_STAFF_ROLES: ReadonlySet<string> = new Set(['admin', 'social_worker']);

const INVITE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface TeamInviteInput {
  toUserId: string;
  inviteDate: string;
  blockType: string;
  note?: string | null;
}

// Structural subset of the authenticated user (`req.user`): only the fields
// the invite rules branch on. Controllers pass `req.user` directly — User
// satisfies this shape.
export interface TeamInviteRequester {
  id: string;
  role: string;
}

interface InviteRow {
  id: string;
  from_user_id: string;
  to_user_id: string;
  invite_date: string;
  block_type: string;
  note: string | null;
  status: string;
  created_at: unknown;
  responded_at: unknown;
  first_name: string | null;
  last_name: string | null;
}

// Invite rows as the client consumes them: entity fields in camelCase plus
// the joined peer's name (`senderName` for incoming, `recipientName` for
// outgoing) assembled first-name-first like the users fullName getter.
export interface InviteListItem {
  id: string;
  fromUserId: string;
  toUserId: string;
  inviteDate: string;
  blockType: string;
  note: string | null;
  status: string;
  createdAt: Date | string | null;
  respondedAt: Date | string | null;
  senderName?: string | null;
  recipientName?: string | null;
}

@Injectable()
export class TeamInvitesService {
  constructor(
    @InjectRepository(TeamInvite)
    private repo: Repository<TeamInvite>,
  ) {}

  private assertBlockType(blockType: string): void {
    if (!BLOCK_TYPES.has(blockType)) {
      throw new BadRequestException(
        `Unknown block type "${blockType}". Allowed: ${[...BLOCK_TYPES].join(', ')}.`,
      );
    }
  }

  private static assertInviteDate(inviteDate: string): void {
    if (typeof inviteDate !== 'string' || !INVITE_DATE_RE.test(inviteDate)) {
      throw new BadRequestException(`Invalid invite date "${String(inviteDate)}". Use YYYY-MM-DD.`);
    }
  }

  async createInvite(dto: TeamInviteInput, requester: TeamInviteRequester): Promise<TeamInvite> {
    this.assertBlockType(dto.blockType);
    TeamInvitesService.assertInviteDate(dto.inviteDate);
    if (dto.toUserId === requester.id) {
      throw new BadRequestException('You cannot invite yourself to a schedule.');
    }
    // Target must exist and be staff (admin/social_worker): coordinators and
    // claimants cannot hold schedule blocks, so they cannot receive invites.
    const target = (await this.repo.manager.query(
      `SELECT id, role FROM users WHERE id = $1`,
      [dto.toUserId],
    )) as Array<{ id: string; role: string }>;
    if (!target || !target[0]) {
      throw new NotFoundException('Invitee not found');
    }
    if (!INVITE_STAFF_ROLES.has(target[0].role)) {
      throw new BadRequestException('Invites can only target staff (admin or social worker).');
    }
    // Duplicate pending invite for the same (from, to, date) returns the
    // existing invite instead of creating a second suggestion.
    const existing = await this.repo.findOne({
      where: {
        fromUserId: requester.id,
        toUserId: dto.toUserId,
        inviteDate: dto.inviteDate,
        status: 'pending',
      },
    });
    if (existing) return existing;

    const row = this.repo.create({
      fromUserId: requester.id,
      toUserId: dto.toUserId,
      inviteDate: dto.inviteDate,
      blockType: dto.blockType,
      note: dto.note ?? null,
      status: 'pending',
    });
    return this.repo.save(row);
  }

  async incoming(userId: string): Promise<InviteListItem[]> {
    // Pending invites addressed to me, with the sender's name joined
    // (first-name-first, like the users fullName getter).
    const rows = (await this.repo.manager.query(
      `SELECT ti.id, ti.from_user_id, ti.to_user_id, ti.invite_date, ti.block_type,
              ti.note, ti.status, ti.created_at, ti.responded_at,
              u.first_name, u.last_name
       FROM team_invites ti
       JOIN users u ON u.id = ti.from_user_id
       WHERE ti.to_user_id = $1 AND ti.status = 'pending'
       ORDER BY ti.created_at DESC`,
      [userId],
    )) as InviteRow[];
    return rows.map(r => TeamInvitesService.toListItem(r, 'senderName'));
  }

  async outgoing(userId: string): Promise<InviteListItem[]> {
    // Invites I sent (all statuses — the sender's history), with the
    // recipient's name joined.
    const rows = (await this.repo.manager.query(
      `SELECT ti.id, ti.from_user_id, ti.to_user_id, ti.invite_date, ti.block_type,
              ti.note, ti.status, ti.created_at, ti.responded_at,
              u.first_name, u.last_name
       FROM team_invites ti
       JOIN users u ON u.id = ti.to_user_id
       WHERE ti.from_user_id = $1
       ORDER BY ti.created_at DESC`,
      [userId],
    )) as InviteRow[];
    return rows.map(r => TeamInvitesService.toListItem(r, 'recipientName'));
  }

  async accept(id: string, requester: TeamInviteRequester): Promise<TeamScheduleBlock> {
    const invite = await this.repo.findOne({ where: { id } });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.toUserId !== requester.id) {
      throw new ForbiddenException('Forbidden: only the invitee can accept this invite.');
    }
    // Single transaction: the status re-check runs INSIDE it, so two
    // concurrent accepts cannot both materialize a block — the loser re-reads
    // a non-pending invite and gets 400 (fix for the double-materialize race;
    // the partial unique index uq_team_invites_pending covers the
    // duplicate-pending-POST twin-row race at the DB level).
    // The re-read takes a pessimistic write lock (SELECT ... FOR UPDATE): a
    // truly simultaneous second accept blocks on the same row until the first
    // commits, then re-reads status 'accepted' → 400. Without the lock,
    // read-committed snapshots let both pass the status re-check and
    // materialize duplicate blocks (no unique constraint backstops that).
    return this.repo.manager.transaction(async em => {
      const fresh = await em.findOne(TeamInvite, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!fresh || fresh.status !== 'pending') {
        throw new BadRequestException('Invite has already been responded to.');
      }
      // Accepting materializes the suggested block AS the invitee: owner,
      // creator and visibility all belong to the invitee (spec: the accepted
      // invite creates the block AS OWNER, visible_to 'team').
      const blocks = em.getRepository(TeamScheduleBlock);
      const block = await blocks.save(
        blocks.create({
          userId: fresh.toUserId,
          blockDate: fresh.inviteDate,
          blockType: fresh.blockType,
          note: fresh.note ?? null,
          visibleTo: 'team',
          createdBy: fresh.toUserId,
        }),
      );
      fresh.status = 'accepted';
      fresh.respondedAt = new Date();
      await em.save(fresh);
      return block;
    });
  }

  async decline(id: string, requester: TeamInviteRequester): Promise<TeamInvite> {
    const invite = await this.repo.findOne({ where: { id } });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.toUserId !== requester.id) {
      throw new ForbiddenException('Forbidden: only the invitee can decline this invite.');
    }
    if (invite.status !== 'pending') {
      throw new BadRequestException('Invite has already been responded to.');
    }
    invite.status = 'declined';
    invite.respondedAt = new Date();
    return this.repo.save(invite);
  }

  private static toListItem(r: InviteRow, nameKey: 'senderName' | 'recipientName'): InviteListItem {
    const name = [r.first_name, r.last_name].filter(Boolean).join(' ').trim();
    return {
      id: r.id,
      fromUserId: r.from_user_id,
      toUserId: r.to_user_id,
      inviteDate: r.invite_date,
      blockType: r.block_type,
      note: r.note ?? null,
      status: r.status,
      createdAt: (r.created_at as Date | string) ?? null,
      respondedAt: (r.responded_at as Date | string) ?? null,
      [nameKey]: name || null,
    };
  }
}