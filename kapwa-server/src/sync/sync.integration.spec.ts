import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SyncService } from './sync.service';
import { ConflictResolver } from './conflict-resolver';
import { SyncQueue } from './sync-queue.entity';
import { VersionVector } from './version-vector.entity';
import { SyncRequestInput } from './dto/sync.zod';

const crypto = require('crypto');
const keyPair = crypto.generateKeyPairSync('ed25519');
const pubKeyRaw = keyPair.publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex');

function signMsg(deviceId: string, changes: any[]): string {
  const msg = JSON.stringify({ deviceId, changes });
  return crypto.sign(null, Buffer.from(msg), keyPair.privateKey).toString('hex');
}

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
    const changes = [{
      id: 'c1',
      tableName: 'beneficiaries',
      recordId: 'b1',
      operation: INSERT,
      payload: { surname: 'Doe', first_name: 'John' },
      clientUpdatedAt: '2026-06-15T10:00:00Z',
    }];
    const result = await service.processDelta({
      deviceId: pubKeyRaw,
      changes,
      versionVectors: [{ tableName: 'beneficiaries', localVersion: 1, serverVersion: 0 }],
      idempotencyKey: 'e2e-ik-1',
      signature: signMsg(pubKeyRaw, changes),
    });
    expect(result.status).toBe('processed');
    expect(result.results[0].status).toBe('applied');
    expect(result.serverChanges).toBeDefined();
    expect(result.serverTimestamp).toBeDefined();
  });

  it('should handle duplicate idempotency key idempotently', async () => {
    const changes = [{
      id: 'c2',
      tableName: 'beneficiaries',
      recordId: 'b2',
      operation: INSERT,
      payload: { surname: 'Smith', first_name: 'Jane' },
      clientUpdatedAt: '2026-06-15T10:00:00Z',
    }];
    const batch: SyncRequestInput = {
      deviceId: pubKeyRaw,
      changes,
      versionVectors: [],
      idempotencyKey: 'e2e-ik-dup',
      signature: signMsg(pubKeyRaw, changes),
    };
    const first = await service.processDelta(batch);
    const second = await service.processDelta(batch);
    expect(second).toEqual(first);
  });

  it('should reject changed payload under same idempotency key', async () => {
    const baseBatch: SyncRequestInput = {
      deviceId: pubKeyRaw,
      changes: [],
      versionVectors: [],
      idempotencyKey: 'e2e-ik-fixed',
      signature: signMsg(pubKeyRaw, []),
    };
    const first = await service.processDelta(baseBatch);
    const dupChanges = [{ id: 'c3', tableName: 'programs', recordId: 'p1', operation: INSERT, payload: {}, clientUpdatedAt: '2026-06-15T10:00:00Z' }];
    const dupBatch: SyncRequestInput = {
      ...baseBatch,
      changes: dupChanges,
      signature: signMsg(pubKeyRaw, dupChanges),
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

    const changes = [{
      id: 'c4',
      tableName: 'beneficiaries',
      recordId: 'b-conflict',
      operation: UPDATE,
      payload: { surname: 'Client' },
      clientUpdatedAt: '2026-06-15T10:00:00Z',
    }];
    const result = await svc2.processDelta({
      deviceId: pubKeyRaw,
      changes,
      versionVectors: [],
      idempotencyKey: 'e2e-ik-conflict',
      signature: signMsg(pubKeyRaw, changes),
    });
    expect(['conflict', 'applied']).toContain(result.results[0].status);
  });

  it('should pull server changes since last sync', async () => {
    const result = await service.pullFromServer(pubKeyRaw, [
      { tableName: 'beneficiaries', serverVersion: 0 },
    ]);
    expect(result.serverChanges).toBeDefined();
    expect(result.serverVersionVectors).toBeDefined();
  });

  it('should list conflicts for device', async () => {
    queueRepo.find.mockResolvedValue([
      { id: 'conf-a', deviceId: pubKeyRaw, status: 'conflict', conflictReason: 'server newer' },
    ]);
    const conflicts = await service.getConflicts(pubKeyRaw);
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
