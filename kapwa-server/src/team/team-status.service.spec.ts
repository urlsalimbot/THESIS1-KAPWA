import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { TeamStatusService } from './team-status.service';
import { TeamStatus } from './team-status.entity';
import { TeamStatusController } from './team-status.controller';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';

describe('TeamStatusService', () => {
  let service: TeamStatusService;
  let repoMock: any;
  let gatewayMock: any;

  const savedRow = {
    id: 'ts1',
    userId: 'w1',
    status: 'in_office',
    note: 'At desk',
    visibleTo: 'team',
    updatedAt: new Date('2026-09-29T01:00:00.000Z'),
  };

  beforeEach(async () => {
    repoMock = {
      upsert: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      manager: { query: jest.fn() },
    };
    gatewayMock = { broadcastTeamStatus: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamStatusService,
        { provide: getRepositoryToken(TeamStatus), useValue: repoMock },
        { provide: NotificationsGateway, useValue: gatewayMock },
      ],
    }).compile();
    service = module.get<TeamStatusService>(TeamStatusService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('rejects an unknown status with 400 and never touches the repo', async () => {
    await expect(
      service.setStatus('w1', { status: 'sleeping_on_the_job' } as any) as any,
    ).rejects.toThrow(/Unknown status|Bad Request/);
    expect(repoMock.upsert).not.toHaveBeenCalled();
    expect(gatewayMock.broadcastTeamStatus).not.toHaveBeenCalled();
  });

  it('rejects an invalid visibleTo with 400 before touching the repo', async () => {
    await expect(
      service.setStatus('w1', { status: 'in_office', visibleTo: 'secret' } as any) as any,
    ).rejects.toThrow(/Unknown status visibility|Bad Request/);
    expect(repoMock.upsert).not.toHaveBeenCalled();
    expect(gatewayMock.broadcastTeamStatus).not.toHaveBeenCalled();
  });

  it('upserts on user_id conflict, refetches, and broadcasts once with the returned row', async () => {
    repoMock.upsert.mockResolvedValue({}); // InsertResult is discarded
    repoMock.findOne.mockResolvedValue(savedRow);

    const row = await service.setStatus('w1', { status: 'in_office', note: 'At desk' });

    expect(repoMock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'w1',
        status: 'in_office',
        note: 'At desk',
        visibleTo: 'team', // default visibility when the toggle is absent
        updatedAt: expect.any(Date), // explicit bump so ON CONFLICT refreshes the timestamp
      }),
      { conflictPaths: ['userId'] },
    );
    expect(repoMock.findOne).toHaveBeenCalledWith({ where: { userId: 'w1' } });
    expect(row).toBe(savedRow);
    // Broadcast exactly once, payload assembled from the persisted row: the
    // visibility toggle + the status owner's barangay ride along so client
    // coordinator viewers can scope their live board.
    expect(gatewayMock.broadcastTeamStatus).toHaveBeenCalledTimes(1);
    expect(gatewayMock.broadcastTeamStatus).toHaveBeenCalledWith({
      userId: 'w1',
      status: 'in_office',
      note: 'At desk',
      updatedAt: savedRow.updatedAt.toISOString(),
      visibleTo: 'team',
      barangay: null,
    });
  });

  it('broadcast carries the requester\u2019s barangay when the call site passes it', async () => {
    repoMock.upsert.mockResolvedValue({});
    repoMock.findOne.mockResolvedValue({ ...savedRow, visibleTo: 'team_coordinators' });

    await service.setStatus('w1', { status: 'in_office', visibleTo: 'team_coordinators' }, 'Bigte');

    expect(gatewayMock.broadcastTeamStatus).toHaveBeenCalledWith({
      userId: 'w1',
      status: 'in_office',
      note: 'At desk',
      updatedAt: savedRow.updatedAt.toISOString(),
      visibleTo: 'team_coordinators',
      barangay: 'Bigte',
    });
  });

  it('persists a null note when the note is omitted (last write wins)', async () => {
    repoMock.upsert.mockResolvedValue({});
    repoMock.findOne.mockResolvedValue({ ...savedRow, status: 'offline', note: null });

    await service.setStatus('w1', { status: 'offline' });

    expect(repoMock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'w1', status: 'offline', note: null }),
      { conflictPaths: ['userId'] },
    );
  });

  it('setStatus round-trips an explicit visibleTo toggle', async () => {
    repoMock.upsert.mockResolvedValue({});
    repoMock.findOne.mockResolvedValue({ ...savedRow, visibleTo: 'team_coordinators' });

    await service.setStatus('w1', { status: 'in_office', visibleTo: 'team_coordinators' });

    expect(repoMock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'w1', visibleTo: 'team_coordinators' }),
      { conflictPaths: ['userId'] },
    );
    // Broadcast payload reflects the toggled visibility (fix: visibleTo rides
    // the broadcast so coordinator viewers can drop team-only rows).
    expect(gatewayMock.broadcastTeamStatus).toHaveBeenCalledWith({
      userId: 'w1',
      status: 'in_office',
      note: 'At desk',
      updatedAt: savedRow.updatedAt.toISOString(),
      visibleTo: 'team_coordinators',
      barangay: null,
    });
  });

  it('never broadcasts when the upsert fails', async () => {
    repoMock.upsert.mockRejectedValue(new Error('db down'));
    await expect(service.setStatus('w1', { status: 'remote' }) as any).rejects.toThrow('db down');
    expect(gatewayMock.broadcastTeamStatus).not.toHaveBeenCalled();
    expect(repoMock.findOne).not.toHaveBeenCalled();
  });

  it('listStatuses returns rows ordered by most recent update', async () => {
    repoMock.find.mockResolvedValue([savedRow]);
    const rows = await service.listStatuses();
    expect(rows).toEqual([savedRow]);
    expect(repoMock.find).toHaveBeenCalledWith(expect.objectContaining({ order: { updatedAt: 'DESC' } }));
  });

  it('listStatuses for a coordinator with no barangay returns an empty list (never all)', async () => {
    const rows = await service.listStatuses('coordinator', undefined);
    expect(rows).toEqual([]);
    expect(repoMock.find).not.toHaveBeenCalled();
  });

  it('listStatuses for a coordinator filters to toggled statuses of their barangay staff', async () => {
    repoMock.manager.query.mockResolvedValue([{ user_id: 'w1' }, { user_id: 'w3' }]);
    repoMock.find.mockResolvedValue([savedRow]);
    const rows = await service.listStatuses('coordinator', 'Bigte');
    expect(repoMock.manager.query).toHaveBeenCalledWith(
      expect.stringContaining('user_barangay_assignments'),
      ['Bigte'],
    );
    expect(repoMock.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: expect.objectContaining({ _type: 'in', _value: ['w1', 'w3'] }),
          visibleTo: 'team_coordinators',
        }),
      }),
    );
    expect(rows).toEqual([savedRow]);
  });

  it('listStatuses for staff stays unfiltered', async () => {
    repoMock.find.mockResolvedValue([savedRow]);
    await service.listStatuses('admin', undefined);
    expect(repoMock.find).toHaveBeenCalledWith(expect.objectContaining({ order: { updatedAt: 'DESC' } }));
    expect(repoMock.manager.query).not.toHaveBeenCalled();
  });

  it('getMyStatus returns the caller\u2019s row, or null when never set', async () => {
    repoMock.findOne.mockResolvedValue(savedRow);
    await expect(service.getMyStatus('w1')).resolves.toBe(savedRow);
    expect(repoMock.findOne).toHaveBeenCalledWith({ where: { userId: 'w1' } });

    repoMock.findOne.mockResolvedValue(null);
    await expect(service.getMyStatus('w2')).resolves.toBeNull();
  });
});

describe('TeamStatusController — guards and role matrix', () => {
  it('is protected by the Jwt/Roles/Abac guard trio', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, TeamStatusController) as Array<{ name: string }>;
    expect(guards.map((g) => g.name)).toEqual(['JwtAuthGuard', 'RolesGuard', 'AbacGuard']);
  });

  it('GET /team/status (own) is staff-only (admin + social_worker)', () => {
    expect(Reflect.getMetadata(ROLES_KEY, TeamStatusController.prototype.getMyStatus)).toEqual([
      'admin',
      'social_worker',
    ]);
  });

  it('PUT /team/status (own) is staff-only (admin + social_worker)', () => {
    expect(Reflect.getMetadata(ROLES_KEY, TeamStatusController.prototype.setStatus)).toEqual([
      'admin',
      'social_worker',
    ]);
  });

  it('GET /team/statuses adds coordinators as read-only viewers', () => {
    expect(Reflect.getMetadata(ROLES_KEY, TeamStatusController.prototype.listStatuses)).toEqual([
      'admin',
      'social_worker',
      'coordinator',
    ]);
  });
});