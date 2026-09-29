import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { TeamInvitesService } from './team-invites.service';
import { TeamInvite } from './team-invite.entity';
import { TeamScheduleBlock } from './team-schedule-block.entity';
import { TeamInvitesController } from './team-invites.controller';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';

describe('TeamInvitesService', () => {
  let service: TeamInvitesService;
  let repoMock: any;
  let blocksRepoMock: any;

  const staffReq = { id: 'w1', role: 'social_worker' };
  const otherReq = { id: 'w2', role: 'social_worker' };
  const inviteeReq = { id: 'w1', role: 'social_worker' };
  const pendingInvite = {
    id: 'i1',
    fromUserId: 'w2',
    toUserId: 'w1',
    inviteDate: '2026-10-05',
    blockType: 'home_visit',
    note: 'Bigte visit?',
    status: 'pending',
  };

  beforeEach(async () => {
    repoMock = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      manager: { query: jest.fn() },
    };
    blocksRepoMock = {
      create: jest.fn(),
      save: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamInvitesService,
        { provide: getRepositoryToken(TeamInvite), useValue: repoMock },
        { provide: getRepositoryToken(TeamScheduleBlock), useValue: blocksRepoMock },
      ],
    }).compile();
    service = module.get<TeamInvitesService>(TeamInvitesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('sends an invite when the target is a staff member', async () => {
    repoMock.manager.query.mockResolvedValue([{ id: 'w2', role: 'social_worker' }]);
    repoMock.findOne.mockResolvedValue(null);
    repoMock.create.mockImplementation((d: any) => d);
    repoMock.save.mockImplementation(async (d: any) => ({ id: 'i1', ...d }));

    const invite = await service.createInvite(
      { toUserId: 'w2', inviteDate: '2026-10-05', blockType: 'home_visit', note: 'Bigte visit?' },
      staffReq as any,
    );

    expect(repoMock.manager.query).toHaveBeenCalledWith(expect.stringContaining('FROM users'), ['w2']);
    expect(repoMock.save).toHaveBeenCalledWith(
      expect.objectContaining({
        fromUserId: 'w1',
        toUserId: 'w2',
        inviteDate: '2026-10-05',
        blockType: 'home_visit',
        note: 'Bigte visit?',
        status: 'pending',
      }),
    );
    expect(invite).toEqual(expect.objectContaining({ id: 'i1', status: 'pending' }));
  });

  it('returns the existing invite when a duplicate pending invite exists (same from, to, date)', async () => {
    repoMock.manager.query.mockResolvedValue([{ id: 'w2', role: 'social_worker' }]);
    repoMock.findOne.mockResolvedValue(pendingInvite);

    const invite = await service.createInvite(
      { toUserId: 'w2', inviteDate: '2026-10-05', blockType: 'home_visit' },
      staffReq as any,
    );

    expect(invite).toEqual(pendingInvite);
    expect(repoMock.create).not.toHaveBeenCalled();
    expect(repoMock.save).not.toHaveBeenCalled();
  });

  it('404 when the target user does not exist', async () => {
    repoMock.manager.query.mockResolvedValue([]);
    await expect(
      service.createInvite({ toUserId: 'nope', inviteDate: '2026-10-05', blockType: 'in_office' } as any, staffReq as any) as any,
    ).rejects.toThrow(/404|not found/i);
    expect(repoMock.save).not.toHaveBeenCalled();
  });

  it('400 when the target is not staff (e.g. a coordinator)', async () => {
    repoMock.manager.query.mockResolvedValue([{ id: 'c1', role: 'coordinator' }]);
    await expect(
      service.createInvite({ toUserId: 'c1', inviteDate: '2026-10-05', blockType: 'in_office' } as any, staffReq as any) as any,
    ).rejects.toThrow(/only target staff|Bad Request/);
    expect(repoMock.save).not.toHaveBeenCalled();
  });

  it('400 when inviting yourself', async () => {
    await expect(
      service.createInvite({ toUserId: 'w1', inviteDate: '2026-10-05', blockType: 'in_office' } as any, staffReq as any) as any,
    ).rejects.toThrow(/invite yourself|Bad Request/);
    expect(repoMock.manager.query).not.toHaveBeenCalled();
  });

  it('400 on an unknown block type without touching the repo', async () => {
    await expect(
      service.createInvite(
        { toUserId: 'w2', inviteDate: '2026-10-05', blockType: 'sleeping_on_the_job' } as any,
        staffReq as any,
      ) as any,
    ).rejects.toThrow(/Unknown block type|Bad Request/);
    expect(repoMock.save).not.toHaveBeenCalled();
  });

  it('400 on a malformed invite date', async () => {
    await expect(
      service.createInvite({ toUserId: 'w2', inviteDate: '10/05/2026', blockType: 'in_office' } as any, staffReq as any) as any,
    ).rejects.toThrow(/Invalid invite date|Bad Request/);
    expect(repoMock.save).not.toHaveBeenCalled();
  });

  it('accept creates the suggested block AS the invitee (owner, creator, team-visible) and marks the invite accepted', async () => {
    repoMock.findOne.mockResolvedValue({ ...pendingInvite, note: null });
    blocksRepoMock.create.mockImplementation((d: any) => d);
    blocksRepoMock.save.mockImplementation(async (d: any) => ({ id: 'b9', ...d }));
    repoMock.save.mockImplementation(async (d: any) => d);

    const block = await service.accept('i1', inviteeReq as any);

    expect(blocksRepoMock.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'w1',
        blockDate: '2026-10-05',
        blockType: 'home_visit',
        note: null,
        visibleTo: 'team',
        createdBy: 'w1',
      }),
    );
    expect(repoMock.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'i1', status: 'accepted', respondedAt: expect.any(Date) }),
    );
    expect(block).toEqual(expect.objectContaining({ id: 'b9', userId: 'w1', visibleTo: 'team' }));
  });

  it('403 when someone other than the invitee accepts', async () => {
    repoMock.findOne.mockResolvedValue(pendingInvite);
    await expect(service.accept('i1', otherReq as any) as any).rejects.toThrow(/Forbidden|403/);
    expect(blocksRepoMock.save).not.toHaveBeenCalled();
    expect(repoMock.save).not.toHaveBeenCalled();
  });

  it('400 when accepting an already-responded invite', async () => {
    repoMock.findOne.mockResolvedValue({ ...pendingInvite, status: 'declined' });
    await expect(service.accept('i1', inviteeReq as any) as any).rejects.toThrow(/already been responded|Bad Request/);
    expect(blocksRepoMock.save).not.toHaveBeenCalled();
    expect(repoMock.save).not.toHaveBeenCalled();
  });

  it('decline records declined + respondedAt and returns the updated invite', async () => {
    repoMock.findOne.mockResolvedValue(pendingInvite);
    repoMock.save.mockImplementation(async (d: any) => d);

    const invite = await service.decline('i1', inviteeReq as any);

    expect(repoMock.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'i1', status: 'declined', respondedAt: expect.any(Date) }),
    );
    expect(invite.status).toBe('declined');
  });

  it('403 when someone other than the invitee declines', async () => {
    repoMock.findOne.mockResolvedValue(pendingInvite);
    await expect(service.decline('i1', otherReq as any) as any).rejects.toThrow(/Forbidden|403/);
    expect(repoMock.save).not.toHaveBeenCalled();
  });

  it('404 when the invite does not exist', async () => {
    repoMock.findOne.mockResolvedValue(null);
    await expect(service.decline('nope', inviteeReq as any) as any).rejects.toThrow(/404|not found/i);
  });

  it('incoming returns my pending invites with the sender name joined', async () => {
    repoMock.manager.query.mockResolvedValue([
      {
        id: 'i1',
        from_user_id: 'w2',
        to_user_id: 'w1',
        invite_date: '2026-10-05',
        block_type: 'home_visit',
        note: 'Bigte visit?',
        status: 'pending',
        created_at: '2026-09-29T01:00:00.000Z',
        responded_at: null,
        first_name: 'Ana',
        last_name: 'Santos',
      },
    ]);

    const rows = await service.incoming('w1');

    expect(repoMock.manager.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE ti.to_user_id = $1 AND ti.status = 'pending'"),
      ['w1'],
    );
    expect(rows).toEqual([
      expect.objectContaining({
        id: 'i1',
        fromUserId: 'w2',
        toUserId: 'w1',
        inviteDate: '2026-10-05',
        blockType: 'home_visit',
        status: 'pending',
        senderName: 'Ana Santos',
      }),
    ]);
  });

  it('outgoing returns invites I sent with the recipient name joined', async () => {
    repoMock.manager.query.mockResolvedValue([
      {
        id: 'i2',
        from_user_id: 'w1',
        to_user_id: 'w3',
        invite_date: '2026-10-06',
        block_type: 'field_day',
        note: null,
        status: 'accepted',
        created_at: '2026-09-29T02:00:00.000Z',
        responded_at: '2026-09-29T03:00:00.000Z',
        first_name: 'Jose',
        last_name: 'Rizal',
      },
    ]);

    const rows = await service.outgoing('w1');

    expect(repoMock.manager.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE ti.from_user_id = $1'),
      ['w1'],
    );
    expect(rows).toEqual([
      expect.objectContaining({
        id: 'i2',
        status: 'accepted',
        recipientName: 'Jose Rizal',
        respondedAt: '2026-09-29T03:00:00.000Z',
      }),
    ]);
  });
});

describe('TeamInvitesController — guards and role matrix', () => {
  it('is protected by the Jwt/Roles/Abac guard trio', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, TeamInvitesController) as Array<{ name: string }>;
    expect(guards.map((g) => g.name)).toEqual(['JwtAuthGuard', 'RolesGuard', 'AbacGuard']);
  });

  it('every handler is staff-only (admin + social_worker) — coordinators cannot send or respond to invites', () => {
    const proto = TeamInvitesController.prototype as any;
    for (const handler of ['create', 'incoming', 'outgoing', 'accept', 'decline']) {
      expect(Reflect.getMetadata(ROLES_KEY, proto[handler])).toEqual(['admin', 'social_worker']);
    }
  });
});