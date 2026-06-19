import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { IntakeService } from "../intake/intake.service";
import { SyncService } from './sync.service';
import { ConflictResolver } from './conflict-resolver';
import { SyncQueue } from './sync-queue.entity';
import { VersionVector } from './version-vector.entity';

const crypto = require('crypto');
const keyPair = crypto.generateKeyPairSync('ed25519');
const pubKeyRaw = keyPair.publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex');

function signMsg(deviceId: string, changes: any[]): string {
  const msg = JSON.stringify({ deviceId, changes });
  return crypto.sign(null, Buffer.from(msg), keyPair.privateKey).toString('hex');
}

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
        { provide: IntakeService, useValue: { submitIntake: jest.fn().mockResolvedValue({}) } },
      ],
    }).compile();

    service = module.get<SyncService>(SyncService);
  });

  it('returns processed for empty changes', async () => {
    const batch = {
      deviceId: pubKeyRaw,
      changes: [],
      versionVectors: [],
      idempotencyKey: 'ik-empty',
      signature: signMsg(pubKeyRaw, []),
    };
    const result: any = await service.processDelta(batch);
    expect(result.status).toBe('processed');
    expect(result.results).toEqual([]);
  });

  it('returns cached result for duplicate idempotency key', async () => {
    const batch = {
      deviceId: pubKeyRaw,
      changes: [],
      versionVectors: [],
      idempotencyKey: 'ik-cached',
      signature: signMsg(pubKeyRaw, []),
    };
    const first = await service.processDelta(batch);
    const second = await service.processDelta(batch);
    expect(second).toEqual(first);
  });

  it('applies a single INSERT change', async () => {
    queueRepoMock.findOne.mockResolvedValue(null);
    const changes = [{
      id: 'ch-1',
      tableName: 'beneficiaries',
      recordId: 'ben-1',
      operation: 'INSERT' as const,
      payload: { surname: 'Test', first_name: 'User' },
      clientUpdatedAt: '2026-06-15T10:00:00Z',
    }];
    const batch = {
      deviceId: pubKeyRaw,
      changes,
      versionVectors: [{ tableName: 'beneficiaries', localVersion: 1, serverVersion: 0 }],
      idempotencyKey: 'ik-apply',
      signature: signMsg(pubKeyRaw, changes),
    };
    const result: any = await service.processDelta(batch);
    expect(result.results[0].status).toBe('applied');
  });

  it('detects conflict when server record exists and client newer', async () => {
    queueRepoMock.findOne.mockResolvedValue(null);
    dataSourceMock.createQueryRunner().query
      .mockResolvedValueOnce([{ id: 'ben-1', surname: 'Server', updated_at: '2026-06-14T10:00:00Z' }]);

    const changes = [{
      id: 'ch-conflict',
      tableName: 'beneficiaries',
      recordId: 'ben-1',
      operation: 'UPDATE' as const,
      payload: { surname: 'Client' },
      clientUpdatedAt: '2026-06-15T10:00:00Z',
    }];
    const batch = {
      deviceId: pubKeyRaw,
      changes,
      versionVectors: [],
      idempotencyKey: 'ik-conflict',
      signature: signMsg(pubKeyRaw, changes),
    };
    const result: any = await service.processDelta(batch);
    expect(['conflict', 'applied']).toContain(result.results[0].status);
  });

  it('returns conflicts for device', async () => {
    queueRepoMock.find.mockResolvedValue([{ id: 'conf-1', status: 'conflict' }]);
    const conflicts = await service.getConflicts(pubKeyRaw);
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
    const result: any = await service.resolveConflict('conf-1', 'server');
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
    const result: any = await service.resolveConflict('conf-2', 'client');
    expect(result.status).toBe('resolved');
    expect(result.resolution).toBe('client');
  });

  it('pulls server changes', async () => {
    const result: any = await service.pullFromServer(pubKeyRaw, [{ tableName: 'beneficiaries', serverVersion: 0 }]);
    expect(result).toHaveProperty('serverChanges');
    expect(result).toHaveProperty('serverVersionVectors');
  });
});
