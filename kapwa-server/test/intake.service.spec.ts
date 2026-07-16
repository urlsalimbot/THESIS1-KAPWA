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
      { fullName: 'Jose Dela Cruz', age: 10, relationship: 'Child', occupation: 'Student' },
    ],
    case: {},
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
    // save order: beneficiary, household, beneficiary(update), familyMember×2, case, consentLedger
    saveMock
      .mockResolvedValueOnce({ id: benUuid, surname: 'Dela Cruz', consentStatus: 'active' })
      .mockResolvedValueOnce({ id: hhUuid, primaryBeneficiaryId: benUuid })
      .mockResolvedValueOnce({ id: benUuid, householdId: hhUuid })
      .mockResolvedValueOnce({ id: 'fm-uuid-1', fullName: 'Maria Dela Cruz' })
      .mockResolvedValueOnce({ id: 'fm-uuid-2', fullName: 'Jose Dela Cruz' })
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
      .mockResolvedValueOnce({ id: 'fm-uuid-2' })
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

  // Test 3: Beneficiary surname stored
  it('should store the beneficiary surname value', async () => {
    const saveMock = mockQueryRunner.manager.save as jest.Mock;
    saveMock
      .mockResolvedValueOnce({ id: benUuid, surname: 'Dela Cruz' })
      .mockResolvedValueOnce({ id: hhUuid })
      .mockResolvedValueOnce({ id: benUuid, householdId: hhUuid })
      .mockResolvedValueOnce({ id: 'fm-uuid-1' })
      .mockResolvedValueOnce({ id: 'fm-uuid-2' })
      .mockResolvedValueOnce({ id: caseUuid })
      .mockResolvedValueOnce({ id: clUuid });

    (benRepo.create as jest.Mock).mockReturnValue({});
    (hhRepo.create as jest.Mock).mockReturnValue({});
    (caseRepo.create as jest.Mock).mockReturnValue({});
    (consentRepo.create as jest.Mock).mockReturnValue({});
    (fmRepo.create as jest.Mock).mockReturnValue({});

    await service.submitIntake(validInput);

    expect(benRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ surname: 'Dela Cruz' })
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
      .mockResolvedValueOnce({ id: 'fm-uuid-2' })
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

  describe('matchCheck', () => {
    it('should call dataSource.query with surname and firstName', async () => {
      mockDataSource.query = jest.fn().mockResolvedValue([]);

      await service.matchCheck(
        { surname: 'Dela Cruz', firstName: 'Juan', familyMembers: [] },
        [],
      );

      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('similarity'),
        ['Dela Cruz', 'Juan', null],
      );
    });

    it('should return empty candidates when no matches', async () => {
      mockDataSource.query = jest.fn().mockResolvedValue([]);

      const result = await service.matchCheck(
        { surname: 'Nonexistent', firstName: 'Nobody' },
        [],
      );

      expect(result).toEqual({ candidates: [] });
    });
  });

  describe('confirmMatch', () => {
    it('should throw NotFoundException for nonexistent household', async () => {
      hhRepo.findOne = jest.fn().mockResolvedValue(null) as any;

      await expect(
        service.confirmMatch('nonexistent-id', validInput, []),
      ).rejects.toThrow('Household not found');
    });

    it('should throw ForbiddenException if worker not permitted for barangay', async () => {
      hhRepo.findOne = jest.fn().mockResolvedValue({ id: 'hh-id', barangay: 'Bigte' }) as any;

      await expect(
        service.confirmMatch('hh-id', validInput, ['Matictic']),
      ).rejects.toThrow('You do not have permission for this barangay');
    });

    it('should create beneficiary with existing householdId on confirm', async () => {
      hhRepo.findOne = jest.fn().mockResolvedValue({ id: 'existing-hh', barangay: 'Bigte' }) as any;
      benRepo.find = jest.fn().mockResolvedValue([{ id: 'existing-ben' }]) as any;

      const saveMock = mockQueryRunner.manager.save as jest.Mock;
      saveMock
        .mockResolvedValueOnce({ id: 'new-ben-id' })
        .mockResolvedValueOnce({ id: 'fm-1' })
        .mockResolvedValueOnce({ id: 'fm-2' })
        .mockResolvedValueOnce({ id: 'new-case-id', controlNo: 'KAPWA-2026-00001' })
        .mockResolvedValueOnce({ id: 'cl-1' });

      (benRepo.create as jest.Mock).mockReturnValue({});
      (hhRepo.create as jest.Mock).mockReturnValue({});
      (caseRepo.create as jest.Mock).mockReturnValue({});
      (consentRepo.create as jest.Mock).mockReturnValue({});
      (fmRepo.create as jest.Mock).mockReturnValue({});

      casesService.generateControlNo = jest.fn().mockResolvedValue('KAPWA-2026-00001');
      caseRepo.findOne = jest.fn().mockResolvedValue(null) as any;

      const result = await service.confirmMatch('existing-hh', validInput, ['Bigte']);

      expect(benRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ householdId: 'existing-hh' }),
      );
      expect(result).toHaveProperty('beneficiaryId', 'new-ben-id');
      expect(result).toHaveProperty('status', 'pending_assessment');
    });
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

    // Valid minimal input should pass
    const minimalValid = {
      beneficiary: {
        surname: 'Test',
        firstName: 'Test',
        gender: 'Male',
        dob: '2000-01-01',
        placeOfBirth: 'Norzagaray, Bulacan',
        civilStatus: 'Single',
        cellularNumber: '09171234567',
        currentAddress: {},
        provincialAddress: {},
        occupation: 'Farmer',
        estimatedMonthlyIncome: 5000,
      },
      case: {},
    };
    const validResult = IntakeInputSchema.safeParse(minimalValid);
    expect(validResult.success).toBe(true);
  });
});
