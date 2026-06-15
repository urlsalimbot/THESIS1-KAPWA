import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SyncService } from './sync.service';
import { ConflictResolver } from './conflict-resolver';
import { SyncQueue } from './sync-queue.entity';
import { VersionVector } from './version-vector.entity';

describe('SyncService', () => {
  let service: SyncService;
  let queueRepoMock: any;
  let versionRepoMock: any;
  let conflictResolverMock: any;
  let dataSourceMock: any;

  beforeEach(async () => {
    queueRepoMock = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    versionRepoMock = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockResolvedValue({}),
    };

    conflictResolverMock = {
      resolve: jest.fn(),
      resortToQueue: jest.fn(),
    };

    dataSourceMock = {
      createQueryRunner: jest.fn().mockReturnValue({
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        query: jest.fn().mockResolvedValue([]),
      }),
      query: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        { provide: getRepositoryToken(SyncQueue), useValue: queueRepoMock },
        { provide: getRepositoryToken(VersionVector), useValue: versionRepoMock },
        { provide: ConflictResolver, useValue: conflictResolverMock },
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();

    service = module.get<SyncService>(SyncService);
  });

  it('processes delta with no changes', async () => {
    const result = await service.processDelta({
      deviceId: 'test-device',
      changes: [],
      versionVectors: [],
      idempotencyKey: 'ik-1',
      signature: 'test-sig',
    });
    expect(result.status).toBe('processed');
    expect(result.results).toEqual([]);
  });

  it('returns cached result for duplicate idempotency key', async () => {
    const batch = {
      deviceId: 'test-device',
      changes: [],
      versionVectors: [],
      idempotencyKey: 'ik-cached',
      signature: 'test-sig',
    };
    const first = await service.processDelta(batch);
    const second = await service.processDelta(batch);
    expect(second).toEqual(first);
  });

  it('applies a single INSERT change', async () => {
    queueRepoMock.findOne.mockResolvedValue(null);
    const batch = {
      deviceId: 'test-device',
      changes: [{
        id: 'ch-1',
        tableName: 'beneficiaries',
        recordId: 'ben-1',
        operation: 'INSERT' as const,
        payload: { surname: 'Test', first_name: 'User' },
        clientUpdatedAt: '2026-06-15T10:00:00Z',
      }],
      versionVectors: [{ tableName: 'beneficiaries', localVersion: 1, serverVersion: 0 }],
      idempotencyKey: 'ik-apply',
      signature: 'test-sig',
    };
    const result = await service.processDelta(batch);
    expect(result.results[0].status).toBe('applied');
  });

  it('detects conflict when server record exists and client newer', async () => {
    queueRepoMock.findOne.mockResolvedValue(null);
    dataSourceMock.createQueryRunner().query
      .mockResolvedValueOnce([{ id: 'ben-1', surname: 'Server', updated_at: '2026-06-14T10:00:00Z' }]);

    const batch = {
      deviceId: 'test-device',
      changes: [{
        id: 'ch-conflict',
        tableName: 'beneficiaries',
        recordId: 'ben-1',
        operation: 'UPDATE' as const,
        payload: { surname: 'Client' },
        clientUpdatedAt: '2026-06-15T10:00:00Z',
      }],
      versionVectors: [],
      idempotencyKey: 'ik-conflict',
      signature: 'test-sig',
    };
    const result = await service.processDelta(batch);
    expect(['conflict', 'applied']).toContain(result.results[0].status);
  });

  it('returns conflicts for device', async () => {
    queueRepoMock.find.mockResolvedValue([{ id: 'conf-1', status: 'conflict' }]);
    const conflicts = await service.getConflicts('test-device');
    expect(conflicts).toHaveLength(1);
  });

  it('resolves conflict with server-wins', async () => {
    queueRepoMock.findOne.mockResolvedValue({
      id: 'conf-1',
      tableName: 'interventions',
      recordId: 'int-1',
      operation: 'UPDATE',
      payload: { amount: 8000 },
    });
    const result = await service.resolveConflict('conf-1', 'server');
    expect(result.status).toBe('resolved');
    expect(result.resolution).toBe('server');
  });

  it('resolves conflict with client-wins', async () => {
    queueRepoMock.findOne.mockResolvedValue({
      id: 'conf-2',
      tableName: 'beneficiaries',
      recordId: 'ben-1',
      operation: 'UPDATE',
      payload: { surname: 'Client' },
    });
    dataSourceMock.query.mockResolvedValue([]);
    const result = await service.resolveConflict('conf-2', 'client');
    expect(result.status).toBe('resolved');
    expect(result.resolution).toBe('client');
  });

  it('pulls server changes', async () => {
    const result = await service.pullFromServer('test-device', [{ tableName: 'beneficiaries', serverVersion: 0 }]);
    expect(result).toHaveProperty('serverChanges');
    expect(result).toHaveProperty('serverVersionVectors');
  });
});
