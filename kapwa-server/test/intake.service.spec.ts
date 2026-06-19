import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { IntakeService } from '../src/intake/intake.service';
import { CasesService } from '../src/cases/cases.service';
import { Beneficiary } from '../src/beneficiaries/beneficiary.entity';
import { Household } from '../src/beneficiaries/household.entity';
import { FamilyMember } from '../src/beneficiaries/family-member.entity';
import { Case, CaseStatus } from '../src/cases/case.entity';
import { ConsentLedger } from '../src/beneficiaries/consent-ledger.entity';
import type { IntakeInput } from '../src/intake/dto/intake.zod';

describe('IntakeService — Consolidated Intake', () => {
  let service: IntakeService;
  let casesService: jest.Mocked<CasesService>;
  let mockDataSource: jest.Mocked<DataSource>;
  let mockQueryRunner: any;
  let benRepo: jest.Mocked<Repository<Beneficiary>>;
  let hhRepo: jest.Mocked<Repository<Household>>;
  let fmRepo: jest.Mocked<Repository<FamilyMember>>;
  let caseRepo: jest.Mocked<Repository<Case>>;
  let consentRepo: jest.Mocked<Repository<ConsentLedger>>;

  const benUuid = 'ben-uuid-1';
  const hhUuid = 'hh-uuid-1';
  const caseUuid = 'case-uuid-1';
  const clUuid = 'cl-uuid-1';

  const validInput: IntakeInput = {
    beneficiary: {
      surname: 'Dela Cruz',
      firstName: 'Juan',
      middleName: 'Santos',
      gender: 'Male',
      dob: '1980-01-15',
      barangay: 'Barangay 1',
      purok: 'Purok A',
      phone: '09171234567',
      category: 'Senior',
    },
    familyMembers: [
      { fullName: 'Maria Dela Cruz', relationship: 'Spouse', age: 45, statusIncome: 'Employed' },
    ],
    case: {
      serviceRequested: ['FA', 'CSR'],
      requirementsChecklist: { med_cert: true, indigency: false, valid_id: true },
      assessedBy: 'MSWDO Worker',
      assignedWorkerId: '00000000-0000-0000-0000-000000000001',
    },
  };

  beforeEach(async () => {
    // Build mock query runner with proper jest.fn() for manager.save
    const saveMock = jest.fn();
    mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        save: saveMock,
      },
    };

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    } as unknown as jest.Mocked<DataSource>;

    benRepo = { create: jest.fn(), save: jest.fn() } as any;
    hhRepo = { create: jest.fn(), save: jest.fn() } as any;
    fmRepo = { create: jest.fn(), save: jest.fn() } as any;
    caseRepo = { create: jest.fn(), save: jest.fn() } as any;
    consentRepo = { create: jest.fn(), save: jest.fn() } as any;

    casesService = {
      generateControlNo: jest.fn().mockResolvedValue('KAPWA-2026-00001'),
    } as any;

    const module = await Test.createTestingModule({
      providers: [
        IntakeService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: getRepositoryToken(Beneficiary), useValue: benRepo },
        { provide: getRepositoryToken(Household), useValue: hhRepo },
        { provide: getRepositoryToken(FamilyMember), useValue: fmRepo },
        { provide: getRepositoryToken(Case), useValue: caseRepo },
        { provide: getRepositoryToken(ConsentLedger), useValue: consentRepo },
        { provide: CasesService, useValue: casesService },
      ],
    }).compile();

    service = module.get<IntakeService>(IntakeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Test 1: Happy path — creates all 5 entities
  it('should create Beneficiary + Household + FamilyMembers + Case + ConsentLedger on successful intake', async () => {
    const saveMock = mockQueryRunner.manager.save as jest.Mock;
    // save order: beneficiary, household, beneficiary(update), familyMember, case, consentLedger
    saveMock
      .mockResolvedValueOnce({ id: benUuid, category: 'Senior', consentStatus: 'active' })
      .mockResolvedValueOnce({ id: hhUuid, primaryBeneficiaryId: benUuid })
      .mockResolvedValueOnce({ id: benUuid, householdId: hhUuid })
      .mockResolvedValueOnce({ id: 'fm-uuid-1', fullName: 'Maria Dela Cruz' })
      .mockResolvedValueOnce({ id: caseUuid, controlNo: 'KAPWA-2026-00001', status: CaseStatus.PENDING })
      .mockResolvedValueOnce({ id: clUuid, status: 'active' });

    (benRepo.create as jest.Mock).mockReturnValue({});
    (hhRepo.create as jest.Mock).mockReturnValue({});
    (caseRepo.create as jest.Mock).mockReturnValue({});
    (consentRepo.create as jest.Mock).mockReturnValue({});
    (fmRepo.create as jest.Mock).mockReturnValue({});

    const result = await service.submitIntake(validInput);

    expect(mockQueryRunner.startTransaction).toHaveBeenCalledWith('SERIALIZABLE');
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
    expect(mockQueryRunner.release).toHaveBeenCalled();

    expect(result).toHaveProperty('beneficiaryId', benUuid);
    expect(result).toHaveProperty('caseId', caseUuid);
    expect(result).toHaveProperty('controlNo', 'KAPWA-2026-00001');
    expect(result).toHaveProperty('status', 'pending_assessment');
  });

  // Test 2: control_no matches KAPWA-YYYY-XXXXX format
  it('should return control_no in KAPWA-YYYY-XXXXX format', async () => {
    const saveMock = mockQueryRunner.manager.save as jest.Mock;
    saveMock
      .mockResolvedValueOnce({ id: benUuid })
      .mockResolvedValueOnce({ id: hhUuid })
      .mockResolvedValueOnce({ id: benUuid, householdId: hhUuid })
      .mockResolvedValueOnce({ id: 'fm-uuid-1' })
      .mockResolvedValueOnce({ id: caseUuid, controlNo: 'KAPWA-2026-00001' })
      .mockResolvedValueOnce({ id: clUuid });

    (benRepo.create as jest.Mock).mockReturnValue({});
    (hhRepo.create as jest.Mock).mockReturnValue({});
    (caseRepo.create as jest.Mock).mockReturnValue({});
    (consentRepo.create as jest.Mock).mockReturnValue({});
    (fmRepo.create as jest.Mock).mockReturnValue({});

    const result = await service.submitIntake(validInput);
    expect(result.controlNo).toMatch(/^KAPWA-\d{4}-\d{5}$/);
  });

  // Test 3: Beneficiary category stored
  it('should store the beneficiary category value', async () => {
    const saveMock = mockQueryRunner.manager.save as jest.Mock;
    saveMock
      .mockResolvedValueOnce({ id: benUuid, category: 'Senior' })
      .mockResolvedValueOnce({ id: hhUuid })
      .mockResolvedValueOnce({ id: benUuid, householdId: hhUuid })
      .mockResolvedValueOnce({ id: 'fm-uuid-1' })
      .mockResolvedValueOnce({ id: caseUuid })
      .mockResolvedValueOnce({ id: clUuid });

    (benRepo.create as jest.Mock).mockReturnValue({});
    (hhRepo.create as jest.Mock).mockReturnValue({});
    (caseRepo.create as jest.Mock).mockReturnValue({});
    (consentRepo.create as jest.Mock).mockReturnValue({});
    (fmRepo.create as jest.Mock).mockReturnValue({});

    await service.submitIntake(validInput);

    expect(benRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'Senior' })
    );
  });

  // Test 4: Rollback on failure
  it('should rollback all entities if case creation fails', async () => {
    const saveMock = mockQueryRunner.manager.save as jest.Mock;
    saveMock
      .mockResolvedValueOnce({ id: benUuid })
      .mockResolvedValueOnce({ id: hhUuid })
      .mockResolvedValueOnce({ id: benUuid, householdId: hhUuid })
      .mockResolvedValueOnce({ id: 'fm-uuid-1' })
      .mockRejectedValueOnce(new Error('Case creation failed'));

    (benRepo.create as jest.Mock).mockReturnValue({});
    (hhRepo.create as jest.Mock).mockReturnValue({});
    (caseRepo.create as jest.Mock).mockReturnValue({});
    (consentRepo.create as jest.Mock).mockReturnValue({});
    (fmRepo.create as jest.Mock).mockReturnValue({});

    await expect(service.submitIntake(validInput)).rejects.toThrow('Case creation failed');

    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(mockQueryRunner.release).toHaveBeenCalled();
  });

  // Test 5: Validation rejects invalid input
  it('should reject invalid IntakeInput via Zod schema validation', async () => {
    const { IntakeInputSchema } = await import('../src/intake/dto/intake.zod');

    // Missing required fields
    const invalidInput = {
      beneficiary: { firstName: 'Juan' } as any,
      case: {},
    };
    const result = IntakeInputSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);

    // Invalid category enum
    const badCategory = {
      ...validInput,
      beneficiary: { ...validInput.beneficiary, category: 'InvalidCat' as any },
    };
    const catResult = IntakeInputSchema.safeParse(badCategory);
    expect(catResult.success).toBe(false);

    // Valid minimal input should pass
    const minimalValid = {
      beneficiary: {
        surname: 'Test',
        firstName: 'Test',
        gender: 'Male',
        dob: '2000-01-01',
        barangay: 'Barangay 1',
      },
      case: {},
    };
    const validResult = IntakeInputSchema.safeParse(minimalValid);
    expect(validResult.success).toBe(true);
  });
});
