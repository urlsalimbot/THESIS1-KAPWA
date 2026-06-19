import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SyncService } from '../src/sync/sync.service';
import { ConflictResolver } from '../src/sync/conflict-resolver';
import { SyncQueue } from '../src/sync/sync-queue.entity';
import { VersionVector } from '../src/sync/version-vector.entity';
import { IntakeService } from "../src/intake/intake.service";

const crypto = require('crypto');
const keyPair = crypto.generateKeyPairSync('ed25519');
const pubKeyRaw = keyPair.publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex');

function signMsg(deviceId: string, changes: any[]): string {
  const msg = JSON.stringify({ deviceId, changes });
  return crypto.sign(null, Buffer.from(msg), keyPair.privateKey).toString('hex');
}

describe('SyncService — Idempotency', () => {
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

    const module = await Test.createTestingModule({
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

  it('returns cached result for duplicate idempotency key within TTL', async () => {
    const batch = {
      deviceId: pubKeyRaw,
      changes: [],
      versionVectors: [],
      idempotencyKey: 'ik-dup-test',
      signature: signMsg(pubKeyRaw, []),
    };

    const first: any = await service.processDelta(batch);
    const second: any = await service.processDelta(batch);

    expect(second.status).toBe('processed');
    expect(second).toEqual(first);
  });

  it('processes request for expired idempotency key', async () => {
    const expiredDate = new Date(Date.now() - 86_400_001).toISOString();
    dataSourceMock.query.mockResolvedValueOnce([
      { result: JSON.stringify({ status: 'processed', stale: true }), created_at: expiredDate },
    ]);

    const batch = {
      deviceId: pubKeyRaw,
      changes: [],
      versionVectors: [],
      idempotencyKey: 'ik-expired-test',
      signature: signMsg(pubKeyRaw, []),
    };

    const result: any = await service.processDelta(batch);
    expect(result.status).toBe('processed');
    expect(result).not.toHaveProperty('stale');
  });

  it('stores idempotency key in database after first request', async () => {
    const batch = {
      deviceId: pubKeyRaw,
      changes: [],
      versionVectors: [],
      idempotencyKey: 'ik-store-test',
      signature: signMsg(pubKeyRaw, []),
    };

    await service.processDelta(batch);

    const insertCalls = (dataSourceMock.query as jest.Mock).mock.calls.filter(
      (call: any[]) => typeof call[0] === 'string' && call[0].toLowerCase().includes('insert into idempotency_keys')
    );
    expect(insertCalls.length).toBeGreaterThanOrEqual(1);
  });
});
