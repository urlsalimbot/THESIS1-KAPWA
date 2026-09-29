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
    updatedAt: new Date('2026-09-29T01:00:00.000Z'),
  };

  beforeEach(async () => {
    repoMock = {
      upsert: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
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

  it('upserts on user_id conflict, refetches, and broadcasts once with the returned row', async () => {
    repoMock.upsert.mockResolvedValue({}); // InsertResult is discarded
    repoMock.findOne.mockResolvedValue(savedRow);

    const row = await service.setStatus('w1', { status: 'in_office', note: 'At desk' });

    expect(repoMock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'w1',
        status: 'in_office',
        note: 'At desk',
        updatedAt: expect.any(Date), // explicit bump so ON CONFLICT refreshes the timestamp
      }),
      { conflictPaths: ['userId'] },
    );
    expect(repoMock.findOne).toHaveBeenCalledWith({ where: { userId: 'w1' } });
    expect(row).toBe(savedRow);
    // Broadcast exactly once, payload assembled from the persisted row
    expect(gatewayMock.broadcastTeamStatus).toHaveBeenCalledTimes(1);
    expect(gatewayMock.broadcastTeamStatus).toHaveBeenCalledWith({
      userId: 'w1',
      status: 'in_office',
      note: 'At desk',
      updatedAt: savedRow.updatedAt.toISOString(),
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
    expect(repoMock.find).toHaveBeenCalledWith({ order: { updatedAt: 'DESC' } });
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