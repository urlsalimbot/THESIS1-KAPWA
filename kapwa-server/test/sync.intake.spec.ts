import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SyncService } from '../src/sync/sync.service';
import { ConflictResolver } from '../src/sync/conflict-resolver';
import { SyncQueue } from '../src/sync/sync-queue.entity';
import { VersionVector } from '../src/sync/version-vector.entity';
import { IntakeService } from '../src/intake/intake.service';

const nodeCrypto = require('crypto');
const keyPair = nodeCrypto.generateKeyPairSync('ed25519');
const pubKeyRaw = keyPair.publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex');

function signMsg(deviceId: string, changes: any[]): string {
  const msg = JSON.stringify({ deviceId, changes });
  return nodeCrypto.sign(null, Buffer.from(msg), keyPair.privateKey).toString('hex');
}

function makeIntakePayload() {
  return {
    beneficiary: {
      surname: 'Dela Cruz',
      firstName: 'Juan',
      middleName: 'Santos',
      gender: 'Male',
      dob: '1990-05-15',
      placeOfBirth: 'Norzagaray, Bulacan',
      civilStatus: 'Married',
      cellularNumber: '09171234567',
      currentAddress: { street: '123 Purok 1', barangay: 'Bigte', city: 'Norzagaray', province: 'Bulacan', postalCode: '3012' },
      provincialAddress: { street: '123 Purok 1', barangay: 'Bigte', city: 'Norzagaray', province: 'Bulacan', postalCode: '3012' },
      occupation: 'Farmer',
      estimatedMonthlyIncome: 8500,
      philhealthNumber: '123456789001',
    },
    familyMembers: [
      { fullName: 'Maria Dela Cruz', age: 35, relationship: 'Spouse', occupation: 'Housewife' },
    ],
    case: {
      serviceRequested: ['FA', 'CSR'],
      requirementsChecklist: { med_cert: true, indigency: false, valid_id: true },
      assessedBy: 'MSWDO Worker',
      assignedWorkerId: undefined,
    },
  };
}

describe('SyncService — Offline Intake Sync', () => {
  let service: SyncService;
  let queueRepoMock: any;
  let versionRepoMock: any;
  let conflictResolverMock: any;
  let dataSourceMock: any;
  let intakeServiceMock: any;

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

    intakeServiceMock = {
      submitIntake: jest.fn().mockResolvedValue({
        beneficiaryId: 'ben-uuid-1',
        caseId: 'case-uuid-1',
        controlNo: 'KAPWA-2026-00001',
        status: 'pending_assessment',
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        SyncService,
        { provide: getRepositoryToken(SyncQueue), useValue: queueRepoMock },
        { provide: getRepositoryToken(VersionVector), useValue: versionRepoMock },
        { provide: ConflictResolver, useValue: conflictResolverMock },
        { provide: DataSource, useValue: dataSourceMock },
        { provide: IntakeService, useValue: intakeServiceMock },
      ],
    }).compile();

    service = module.get<SyncService>(SyncService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============= Task 1 Tests (RED phase) =============

  // Test 1 — Sync processor dispatches 'intake' tableName to IntakeService
  it('should dispatch intake tableName to IntakeService.submitIntake()', async () => {
    queueRepoMock.findOne.mockResolvedValue(null);

    const intakePayload = makeIntakePayload();
    const changes = [{
      id: 'intake-ch-dispatch',
      tableName: 'intake',
      recordId: nodeCrypto.randomUUID(),
      operation: 'INSERT' as const,
      payload: intakePayload,
      clientUpdatedAt: '2026-06-19T10:00:00Z',
    }];

    const batch = {
      deviceId: pubKeyRaw,
      changes,
      versionVectors: [],
      idempotencyKey: 'ik-intake-dispatch',
      signature: signMsg(pubKeyRaw, changes),
    };

    const result: any = await service.processDelta(batch);

    expect(intakeServiceMock.submitIntake).toHaveBeenCalledTimes(1);
    expect(result.results[0].status).toBe('applied');
  });

  // Test 2 — Full consolidated payload is passed to submitIntake()
  it('should pass the full consolidated intake payload to submitIntake()', async () => {
    queueRepoMock.findOne.mockResolvedValue(null);

    const intakePayload = makeIntakePayload();
    const changes = [{
      id: 'intake-ch-payload',
      tableName: 'intake',
      recordId: nodeCrypto.randomUUID(),
      operation: 'INSERT' as const,
      payload: intakePayload,
      clientUpdatedAt: '2026-06-19T10:00:00Z',
    }];

    const batch = {
      deviceId: pubKeyRaw,
      changes,
      versionVectors: [],
      idempotencyKey: 'ik-intake-payload',
      signature: signMsg(pubKeyRaw, changes),
    };

    await service.processDelta(batch);

    expect(intakeServiceMock.submitIntake).toHaveBeenCalledWith(
      expect.objectContaining({
        beneficiary: expect.objectContaining({
          surname: 'Dela Cruz',
          firstName: 'Juan',
          cellularNumber: '09171234567',
        }),
        familyMembers: expect.arrayContaining([
          expect.objectContaining({ fullName: 'Maria Dela Cruz' }),
        ]),
        case: expect.objectContaining({
          serviceRequested: expect.arrayContaining(['FA', 'CSR']),
        }),
      }),
    );
  });

  // Test 3 — Duplicate intake sync rejected by idempotency key
  it('should reject duplicate intake sync via idempotency key', async () => {
    queueRepoMock.findOne.mockResolvedValue(null);

    const intakePayload = makeIntakePayload();
    const changes = [{
      id: 'intake-ch-dup',
      tableName: 'intake',
      recordId: nodeCrypto.randomUUID(),
      operation: 'INSERT' as const,
      payload: intakePayload,
      clientUpdatedAt: '2026-06-19T10:00:00Z',
    }];

    const batch = {
      deviceId: pubKeyRaw,
      changes,
      versionVectors: [],
      idempotencyKey: 'ik-intake-dup',
      signature: signMsg(pubKeyRaw, changes),
    };

    // First call — should process intake
    const first: any = await service.processDelta(batch);
    expect(intakeServiceMock.submitIntake).toHaveBeenCalledTimes(1);
    expect(first.results[0].status).toBe('applied');

    // Second call with same batch idempotency key — should return cached result
    const second: any = await service.processDelta(batch);
    expect(intakeServiceMock.submitIntake).toHaveBeenCalledTimes(1); // Not called again
    expect(second.status).toBe('processed');
    expect(second).toEqual(first);
  });

  // Test 4 — Failed sync marks queue entry as 'failed'
  it('should mark sync result as failed when IntakeService throws', async () => {
    queueRepoMock.findOne.mockResolvedValue(null);
    intakeServiceMock.submitIntake.mockRejectedValue(new Error('Invalid intake data'));

    const intakePayload = makeIntakePayload();
    const changes = [{
      id: 'intake-ch-fail',
      tableName: 'intake',
      recordId: nodeCrypto.randomUUID(),
      operation: 'INSERT' as const,
      payload: intakePayload,
      clientUpdatedAt: '2026-06-19T10:00:00Z',
    }];

    const batch = {
      deviceId: pubKeyRaw,
      changes,
      versionVectors: [],
      idempotencyKey: 'ik-intake-fail',
      signature: signMsg(pubKeyRaw, changes),
    };

    const result: any = await service.processDelta(batch);

    expect(result.results[0].status).toBe('failed');
    expect(result.results[0].reason).toContain('Invalid intake data');
  });

  // ============= Task 3 Tests (additional integration) =============

  // Test 5 — End-to-end sync simulation
  it('should create queue entry with applied status after successful intake sync', async () => {
    queueRepoMock.findOne.mockResolvedValue(null);
    queueRepoMock.create.mockReturnValue({});

    const intakePayload = makeIntakePayload();
    const changes = [{
      id: 'intake-ch-e2e',
      tableName: 'intake',
      recordId: nodeCrypto.randomUUID(),
      operation: 'INSERT' as const,
      payload: intakePayload,
      clientUpdatedAt: '2026-06-19T10:00:00Z',
    }];

    const batch = {
      deviceId: pubKeyRaw,
      changes,
      versionVectors: [],
      idempotencyKey: 'ik-intake-e2e',
      signature: signMsg(pubKeyRaw, changes),
    };

    const result: any = await service.processDelta(batch);

    // Verify IntakeService was called with correct payload
    expect(intakeServiceMock.submitIntake).toHaveBeenCalledTimes(1);
    expect(intakeServiceMock.submitIntake).toHaveBeenCalledWith(intakePayload);

    // Verify queue entry was created with correct fields
    expect(queueRepoMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: 'intake',
        status: 'applied',
        idempotencyKey: 'intake-ch-e2e',
        operation: 'INSERT',
        payload: intakePayload,
      }),
    );
    expect(queueRepoMock.save).toHaveBeenCalled();

    // Verify sync result
    expect(result.results[0].status).toBe('applied');
    expect(result.results[0].tableName).toBe('intake');
  });

  // Test 6 — Rollback propagation
  it('should mark sync result as failed and not create queue entry when submitIntake throws', async () => {
    queueRepoMock.findOne.mockResolvedValue(null);
    intakeServiceMock.submitIntake.mockRejectedValue(new Error('Database constraint violation'));
    queueRepoMock.create.mockClear();
    queueRepoMock.save.mockClear();

    const intakePayload = makeIntakePayload();
    const changes = [{
      id: 'intake-ch-rollback',
      tableName: 'intake',
      recordId: nodeCrypto.randomUUID(),
      operation: 'INSERT' as const,
      payload: intakePayload,
      clientUpdatedAt: '2026-06-19T10:00:00Z',
    }];

    const batch = {
      deviceId: pubKeyRaw,
      changes,
      versionVectors: [],
      idempotencyKey: 'ik-intake-rollback',
      signature: signMsg(pubKeyRaw, changes),
    };

    const result: any = await service.processDelta(batch);

    // Verify the sync result shows failure with correct reason
    expect(result.results[0].status).toBe('failed');
    expect(result.results[0].reason).toContain('Database constraint violation');
    expect(result.results[0].changeId).toBe('intake-ch-rollback');

    // Verify IntakeService was called (it threw, but was called)
    expect(intakeServiceMock.submitIntake).toHaveBeenCalledTimes(1);

    // No 'applied' queue entry should be created for the failed intake
    const appliedCreateCalls = (queueRepoMock.create as jest.Mock).mock.calls.filter(
      (call: any[]) => call[0]?.status === 'applied'
    );
    expect(appliedCreateCalls.length).toBe(0);
  });
});
