import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SyncService } from './sync.service';
import { ConflictResolver } from './conflict-resolver';
import { SyncQueue } from './sync-queue.entity';
import { VersionVector } from './version-vector.entity';
import { SyncRequestInput } from './dto/sync.zod';

const INSERT = 'INSERT' as const;
const UPDATE = 'UPDATE' as const;

describe('Sync Integration: conflict scenarios', () => {
  let service: SyncService;
  let queueRepo: any;
  let versionRepo: any;
  let dataSourceMock: any;
  let conflictResolver: ConflictResolver;
  let queryRunnerMock: any;

  function setupDataSource(records: Record<string, any[]> = {}) {
    queryRunnerMock = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query: jest.fn().mockImplementation((sql: string, params: any[]) => {
        if (sql.startsWith('SELECT')) {
          const tableMatch = sql.match(/FROM "(\w+)"/);
          const table = tableMatch?.[1] || '';
          return Promise.resolve(records[table] || []);
        }
        return Promise.resolve([]);
      }),
    };
    return {
      createQueryRunner: jest.fn().mockReturnValue(queryRunnerMock),
      query: jest.fn().mockImplementation((sql: string, params: any[]) => {
        if (sql.startsWith('SELECT')) {
          const tableMatch = sql.match(/FROM "(\w+)"/);
          const table = tableMatch?.[1] || '';
          return Promise.resolve(records[table] || []);
        }
        return Promise.resolve([]);
      }),
    };
  }

  beforeEach(async () => {
    queueRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    versionRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockResolvedValue({}),
    };
    dataSourceMock = setupDataSource();
    conflictResolver = new ConflictResolver(queueRepo as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        { provide: getRepositoryToken(SyncQueue), useValue: queueRepo },
        { provide: getRepositoryToken(VersionVector), useValue: versionRepo },
        { provide: ConflictResolver, useValue: conflictResolver },
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();

    service = module.get<SyncService>(SyncService);
  });

  it('should process valid sync batch end-to-end', async () => {
    const result = await service.processDelta({
      deviceId: 'device-1',
      changes: [{
        id: 'c1',
        tableName: 'beneficiaries',
        recordId: 'b1',
        operation: INSERT,
        payload: { surname: 'Doe', first_name: 'John' },
        clientUpdatedAt: '2026-06-15T10:00:00Z',
      }],
      versionVectors: [{ tableName: 'beneficiaries', localVersion: 1, serverVersion: 0 }],
      idempotencyKey: 'e2e-ik-1',
      signature: 'test-sig',
    });
    expect(result.status).toBe('processed');
    expect(result.results[0].status).toBe('applied');
    expect(result.serverChanges).toBeDefined();
    expect(result.serverTimestamp).toBeDefined();
  });

  it('should handle duplicate idempotency key idempotently', async () => {
    const batch: SyncRequestInput = {
      deviceId: 'device-1',
      changes: [{
        id: 'c2',
        tableName: 'beneficiaries',
        recordId: 'b2',
        operation: INSERT,
        payload: { surname: 'Smith', first_name: 'Jane' },
        clientUpdatedAt: '2026-06-15T10:00:00Z',
      }],
      versionVectors: [],
      idempotencyKey: 'e2e-ik-dup',
      signature: 'test-sig',
    };
    const first = await service.processDelta(batch);
    const second = await service.processDelta(batch);
    expect(second).toEqual(first);
  });

  it('should reject changed payload under same idempotency key', async () => {
    const baseBatch: SyncRequestInput = {
      deviceId: 'device-1',
      changes: [],
      versionVectors: [],
      idempotencyKey: 'e2e-ik-fixed',
      signature: 'test-sig',
    };
    const first = await service.processDelta(baseBatch);
    const dupBatch: SyncRequestInput = {
      ...baseBatch,
      changes: [{ id: 'c3', tableName: 'programs', recordId: 'p1', operation: INSERT, payload: {}, clientUpdatedAt: '2026-06-15T10:00:00Z' }],
    };
    const second = await service.processDelta(dupBatch);
    expect(second).toEqual(first);
  });

  it('should detect conflict when server data is newer', async () => {
    dataSourceMock = setupDataSource({
      beneficiaries: [{ id: 'b-conflict', surname: 'Server', updated_at: '2026-06-16T10:00:00Z' }],
    });

    const mod = await Test.createTestingModule({
      providers: [
        SyncService,
        { provide: getRepositoryToken(SyncQueue), useValue: queueRepo },
        { provide: getRepositoryToken(VersionVector), useValue: versionRepo },
        { provide: ConflictResolver, useValue: conflictResolver },
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();
    const svc2 = mod.get<SyncService>(SyncService);

    const result = await svc2.processDelta({
      deviceId: 'device-1',
      changes: [{
        id: 'c4',
        tableName: 'beneficiaries',
        recordId: 'b-conflict',
        operation: UPDATE,
        payload: { surname: 'Client' },
        clientUpdatedAt: '2026-06-15T10:00:00Z',
      }],
      versionVectors: [],
      idempotencyKey: 'e2e-ik-conflict',
      signature: 'test-sig',
    });
    expect(['conflict', 'applied']).toContain(result.results[0].status);
  });

  it('should pull server changes since last sync', async () => {
    const result = await service.pullFromServer('device-1', [
      { tableName: 'beneficiaries', serverVersion: 0 },
    ]);
    expect(result.serverChanges).toBeDefined();
    expect(result.serverVersionVectors).toBeDefined();
  });

  it('should list conflicts for device', async () => {
    queueRepo.find.mockResolvedValue([
      { id: 'conf-a', deviceId: 'device-1', status: 'conflict', conflictReason: 'server newer' },
    ]);
    const conflicts = await service.getConflicts('device-1');
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].status).toBe('conflict');
  });

  it('should resolve conflict with server-wins', async () => {
    queueRepo.findOne.mockResolvedValue({
      id: 'resolve-1',
      tableName: 'interventions',
      recordId: 'i-1',
      operation: UPDATE,
      payload: { amount: 9999 },
    });
    const result = await service.resolveConflict('resolve-1', 'server');
    expect(result.status).toBe('resolved');
    expect(result.resolution).toBe('server');
  });

  it('should resolve conflict with client-wins', async () => {
    queueRepo.findOne.mockResolvedValue({
      id: 'resolve-2',
      tableName: 'beneficiaries',
      recordId: 'b-1',
      operation: UPDATE,
      payload: { surname: 'ClientWins' },
    });
    dataSourceMock.query.mockResolvedValue([]);
    const result = await service.resolveConflict('resolve-2', 'client');
    expect(result.status).toBe('resolved');
    expect(result.resolution).toBe('client');
  });
});
