import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { IntakeService } from '../src/intake/intake.service';
import { CasesService } from '../src/cases/cases.service';
import { Person } from '../src/beneficiaries/person.entity';
import { HouseholdMembership } from '../src/beneficiaries/household-membership.entity';
import { Beneficiary } from '../src/beneficiaries/beneficiary.entity';
import { Household } from '../src/beneficiaries/household.entity';
import { Case, CaseStatus } from '../src/cases/case.entity';
import { BeneficiaryClaimant } from '../src/beneficiaries/beneficiary-claimant.entity';
import { ConsentLedger } from '../src/beneficiaries/consent-ledger.entity';
import type { IntakeInput, BatchFamilyInput } from '../src/intake/dto/intake.zod';

describe('IntakeService — Consolidated Intake', () => {
  let service: IntakeService;
  let casesService: jest.Mocked<CasesService>;
  let mockDataSource: jest.Mocked<DataSource>;
  let mockQueryRunner: any;
  let personRepo: jest.Mocked<Repository<Person>>;
  let benRepo: jest.Mocked<Repository<Beneficiary>>;
  let hhRepo: jest.Mocked<Repository<Household>>;
  let hmRepo: jest.Mocked<Repository<HouseholdMembership>>;
  let caseRepo: jest.Mocked<Repository<Case>>;
  let consentRepo: jest.Mocked<Repository<ConsentLedger>>;

  const benUuid = 'ben-uuid-1';
  const hhUuid = 'hh-uuid-1';
  const caseUuid = 'case-uuid-1';
  const clUuid = 'cl-uuid-1';

  const claimUuid = 'claim-uuid-1';
  const bcUuid = 'bc-uuid-1';

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
      email: 'juan.delacruz@example.com',
      currentAddress: { street: '123 Purok 1', barangay: 'Bigte', city: 'Norzagaray', province: 'Bulacan', region: '03', postalCode: '3012' },
      occupation: 'Farmer',
      estimatedMonthlyIncome: 8500,
      philhealthNumber: '123456789001',
    },
    claimant: {
      surname: 'Dela Cruz',
      firstName: 'Maria',
      middleName: 'Santos',
      gender: 'Female',
      dob: '1992-08-20',
      placeOfBirth: 'Norzagaray, Bulacan',
      civilStatus: 'Married',
      cellularNumber: '09179876543',
      email: 'maria.delacruz@example.com',
      currentAddress: { street: '123 Purok 1', barangay: 'Bigte', city: 'Norzagaray', province: 'Bulacan', region: '03', postalCode: '3012' },
      occupation: 'Housewife',
      estimatedMonthlyIncome: 1,
      relationshipToBeneficiary: 'Spouse',
    },
    familyMembers: [
      { surname: 'Dela Cruz', firstName: 'Jose', middleName: '', gender: 'Male', dob: '2015-06-15', age: 10, relationship: 'Child', occupation: 'Student' },
    ],
    case: {},
  };

  beforeEach(async () => {
    // Build mock query runner with proper jest.fn() for manager.save
    const saveMock = jest.fn();
    const createMock = jest.fn();
    const findOneMock = jest.fn().mockResolvedValue(null);
    mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query: jest.fn().mockResolvedValue(undefined),
      manager: {
        save: saveMock,
        create: createMock,
        findOne: findOneMock,
      },
    };

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    } as unknown as jest.Mocked<DataSource>;

    personRepo = { create: jest.fn(), save: jest.fn(), findOne: jest.fn().mockResolvedValue(null) } as any;
    benRepo = { create: jest.fn(), save: jest.fn() } as any;
    hhRepo = { create: jest.fn(), save: jest.fn() } as any;
    hmRepo = { create: jest.fn(), save: jest.fn() } as any;
    caseRepo = { create: jest.fn(), save: jest.fn() } as any;
    consentRepo = { create: jest.fn(), save: jest.fn() } as any;

    casesService = {
      generateControlNo: jest.fn().mockResolvedValue('KAPWA-2026-00001'),
    } as any;

    const module = await Test.createTestingModule({
      providers: [
        IntakeService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: getRepositoryToken(Person), useValue: personRepo },
        { provide: getRepositoryToken(Beneficiary), useValue: benRepo },
        { provide: getRepositoryToken(Household), useValue: hhRepo },
        { provide: getRepositoryToken(HouseholdMembership), useValue: hmRepo },
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

  // Test 1: Happy path — creates all entities
  it('should create Person + Beneficiary + Claimant + HouseholdMemberships + Case + ConsentLedger on successful intake', async () => {
    const saveMock = mockQueryRunner.manager.save as jest.Mock;
    // save order: Person(beneficiary), Beneficiary, Person(claimant), BeneficiaryClaimant, Household, Beneficiary(update), Person(FM), HouseholdMembership, Case, ConsentLedger
    saveMock
      .mockResolvedValueOnce({ id: 'person-uuid-1' })
      .mockResolvedValueOnce({ id: benUuid, surname: 'Dela Cruz', consentStatus: 'active' })
      .mockResolvedValueOnce({ id: claimUuid })
      .mockResolvedValueOnce({ id: bcUuid })
      .mockResolvedValueOnce({ id: hhUuid, primaryBeneficiaryId: benUuid })
      .mockResolvedValueOnce({ id: benUuid, householdId: hhUuid })
      .mockResolvedValueOnce({ id: 'fm-person-1' })
      .mockResolvedValueOnce({ id: 'hm-uuid-1' })
      .mockResolvedValueOnce({ id: caseUuid, controlNo: 'KAPWA-2026-00001', status: CaseStatus.ENROLLED })
      .mockResolvedValueOnce({ id: clUuid, status: 'active' });

    (personRepo.create as jest.Mock).mockReturnValue({});
    (benRepo.create as jest.Mock).mockReturnValue({});
    (hhRepo.create as jest.Mock).mockReturnValue({});
    (caseRepo.create as jest.Mock).mockReturnValue({});
    (consentRepo.create as jest.Mock).mockReturnValue({});

    const result = await service.submitIntake(validInput);

    expect(mockQueryRunner.startTransaction).toHaveBeenCalledWith('SERIALIZABLE');
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
    expect(mockQueryRunner.release).toHaveBeenCalled();

    expect(result).toHaveProperty('beneficiaryId', benUuid);
    expect(result).toHaveProperty('caseId', caseUuid);
    expect(result).toHaveProperty('controlNo', 'KAPWA-2026-00001');
    expect(result).toHaveProperty('status', CaseStatus.ENROLLED);
  });

  // Test 2: control_no matches KAPWA-YYYY-XXXXX format
  it('should return control_no in KAPWA-YYYY-XXXXX format', async () => {
    const saveMock = mockQueryRunner.manager.save as jest.Mock;
    saveMock
      .mockResolvedValueOnce({ id: 'person-uuid-1' })
      .mockResolvedValueOnce({ id: benUuid })
      .mockResolvedValueOnce({ id: claimUuid })
      .mockResolvedValueOnce({ id: bcUuid })
      .mockResolvedValueOnce({ id: hhUuid })
      .mockResolvedValueOnce({ id: benUuid, householdId: hhUuid })
      .mockResolvedValueOnce({ id: 'fm-person-1' })
      .mockResolvedValueOnce({ id: 'hm-uuid-1' })
      .mockResolvedValueOnce({ id: caseUuid, controlNo: 'KAPWA-2026-00001' })
      .mockResolvedValueOnce({ id: clUuid });

    (personRepo.create as jest.Mock).mockReturnValue({});
    (benRepo.create as jest.Mock).mockReturnValue({});
    (hhRepo.create as jest.Mock).mockReturnValue({});
    (caseRepo.create as jest.Mock).mockReturnValue({});
    (consentRepo.create as jest.Mock).mockReturnValue({});

    const result = await service.submitIntake(validInput);
    expect(result.controlNo).toMatch(/^KAPWA-\d{4}-\d{5}$/);
  });

  // Test 3: Beneficiary surname stored
  it('should store the beneficiary surname value', async () => {
    const saveMock = mockQueryRunner.manager.save as jest.Mock;
    saveMock
      .mockResolvedValueOnce({ id: 'person-uuid-1' })
      .mockResolvedValueOnce({ id: benUuid, surname: 'Dela Cruz' })
      .mockResolvedValueOnce({ id: claimUuid })
      .mockResolvedValueOnce({ id: bcUuid })
      .mockResolvedValueOnce({ id: hhUuid })
      .mockResolvedValueOnce({ id: benUuid, householdId: hhUuid })
      .mockResolvedValueOnce({ id: 'fm-person-1' })
      .mockResolvedValueOnce({ id: 'hm-uuid-1' })
      .mockResolvedValueOnce({ id: caseUuid })
      .mockResolvedValueOnce({ id: clUuid });

    (personRepo.create as jest.Mock).mockReturnValue({});
    (benRepo.create as jest.Mock).mockReturnValue({});
    (hhRepo.create as jest.Mock).mockReturnValue({});
    (caseRepo.create as jest.Mock).mockReturnValue({});
    (consentRepo.create as jest.Mock).mockReturnValue({});

    await service.submitIntake(validInput);

    expect(personRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ surname: 'Dela Cruz' })
    );
    expect(benRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ consentStatus: 'active' })
    );
  });

  // Test 4: Rollback on failure
  it('should rollback all entities if case creation fails', async () => {
    const saveMock = mockQueryRunner.manager.save as jest.Mock;
    saveMock
      .mockResolvedValueOnce({ id: 'person-uuid-1' })
      .mockResolvedValueOnce({ id: benUuid })
      .mockResolvedValueOnce({ id: claimUuid })
      .mockResolvedValueOnce({ id: bcUuid })
      .mockResolvedValueOnce({ id: hhUuid })
      .mockResolvedValueOnce({ id: benUuid, householdId: hhUuid })
      .mockResolvedValueOnce({ id: 'fm-person-1' })
      .mockResolvedValueOnce({ id: 'hm-uuid-1' })
      .mockRejectedValueOnce(new Error('Case creation failed'));

    (personRepo.create as jest.Mock).mockReturnValue({});
    (benRepo.create as jest.Mock).mockReturnValue({});
    (hhRepo.create as jest.Mock).mockReturnValue({});
    (caseRepo.create as jest.Mock).mockReturnValue({});
    (consentRepo.create as jest.Mock).mockReturnValue({});

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
        .mockResolvedValueOnce({ id: 'person-uuid' })
        .mockResolvedValueOnce({ id: 'new-ben-id' })
        .mockResolvedValueOnce({ id: claimUuid })
        .mockResolvedValueOnce({ id: bcUuid })
        .mockResolvedValueOnce({ id: 'fm-person-1' })
        .mockResolvedValueOnce({ id: 'hm-uuid-1' })
        .mockResolvedValueOnce({ id: 'new-case-id', controlNo: 'KAPWA-2026-00001' })
        .mockResolvedValueOnce({ id: 'cl-1' });

      (personRepo.create as jest.Mock).mockReturnValue({});
      (benRepo.create as jest.Mock).mockReturnValue({});
      (hhRepo.create as jest.Mock).mockReturnValue({});
      (caseRepo.create as jest.Mock).mockReturnValue({});
      (consentRepo.create as jest.Mock).mockReturnValue({});

      casesService.generateControlNo = jest.fn().mockResolvedValue('KAPWA-2026-00001');
      caseRepo.findOne = jest.fn().mockResolvedValue(null) as any;

      const result = await service.confirmMatch('existing-hh', validInput, ['Bigte']);

      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
        Beneficiary,
        expect.objectContaining({ householdId: 'existing-hh' }),
      );
      expect(result).toHaveProperty('beneficiaryId', 'new-ben-id');
    expect(result).toHaveProperty('status', CaseStatus.ENROLLED);
    });
  });

  describe('family member person build', () => {
    it('should save the member person with gender, dob, and computed age', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 6, 31, 12));

      const saveMock = mockQueryRunner.manager.save as jest.Mock;
      // save order: Person(ben), Beneficiary, Person(claimant), BeneficiaryClaimant, Household, Beneficiary(update), Person(FM), HouseholdMembership, Case, ConsentLedger
      saveMock
        .mockResolvedValueOnce({ id: 'person-uuid-1' })
        .mockResolvedValueOnce({ id: benUuid })
        .mockResolvedValueOnce({ id: claimUuid })
        .mockResolvedValueOnce({ id: bcUuid })
        .mockResolvedValueOnce({ id: hhUuid })
        .mockResolvedValueOnce({ id: benUuid, householdId: hhUuid })
        .mockResolvedValueOnce({ id: 'fm-person-1' })
        .mockResolvedValueOnce({ id: 'hm-uuid-1' })
        .mockResolvedValueOnce({ id: caseUuid })
        .mockResolvedValueOnce({ id: clUuid });

      (personRepo.create as jest.Mock).mockImplementation((data: any) => data);
      (benRepo.create as jest.Mock).mockReturnValue({});
      (hhRepo.create as jest.Mock).mockReturnValue({});
      (caseRepo.create as jest.Mock).mockReturnValue({});
      (consentRepo.create as jest.Mock).mockReturnValue({});

      try {
        await service.submitIntake({
          ...validInput,
          familyMembers: [
            { surname: 'Dela Cruz', firstName: 'Jose', gender: 'Female', dob: '2010-06-15', relationship: 'Child' },
          ],
        });

        const fmSaveCall = saveMock.mock.calls[6];
        expect(fmSaveCall[0]).toBe(Person);
        expect(fmSaveCall[1]).toMatchObject({ surname: 'Dela Cruz', firstName: 'Jose', gender: 'Female' });
        expect(fmSaveCall[1].dob).toEqual(new Date('2010-06-15'));
        expect(fmSaveCall[1].age).toBe(16);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('submitBatchFamily', () => {
    const batchInput: BatchFamilyInput = {
      primary: {
        surname: 'Dela Cruz',
        firstName: 'Juan',
        gender: 'Male',
        dob: '1990-01-01',
        currentAddress: { street: '123 Purok 1', barangay: 'Bigte', city: 'Norzagaray', province: 'Bulacan', region: '03', postalCode: '3012' },
      },
      members: [
        { surname: 'Dela Cruz', firstName: 'Ana', gender: 'Female', dob: '1992-02-02', relationship: 'Spouse' },
      ],
    };

    it('creates the primary case, a household, and links members, returning the primary caseId', async () => {
      const saveMock = mockQueryRunner.manager.save as jest.Mock;
      saveMock
        .mockResolvedValueOnce({ id: 'person-uuid-1' })
        .mockResolvedValueOnce({ id: benUuid, surname: 'Dela Cruz', consentStatus: 'active' })
        .mockResolvedValueOnce({ id: claimUuid })
        .mockResolvedValueOnce({ id: bcUuid })
        .mockResolvedValueOnce({ id: hhUuid, primaryBeneficiaryId: benUuid })
        .mockResolvedValueOnce({ id: benUuid, householdId: hhUuid })
        .mockResolvedValueOnce({ id: 'fm-person-1' })
        .mockResolvedValueOnce({ id: 'hm-uuid-1' })
        .mockResolvedValueOnce({ id: caseUuid, controlNo: 'KAPWA-2026-00001', status: CaseStatus.ENROLLED })
        .mockResolvedValueOnce({ id: clUuid, status: 'active' });

      (personRepo.create as jest.Mock).mockReturnValue({});
      (benRepo.create as jest.Mock).mockReturnValue({});
      (hhRepo.create as jest.Mock).mockReturnValue({});
      (caseRepo.create as jest.Mock).mockReturnValue({});
      (consentRepo.create as jest.Mock).mockReturnValue({});

      const result = await service.submitBatchFamily(batchInput);

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
      expect(result).toHaveProperty('caseId', caseUuid);
      expect(result).toHaveProperty('beneficiaryId', benUuid);
      expect(result).toHaveProperty('status', CaseStatus.ENROLLED);
      expect(hhRepo.create).toHaveBeenCalledWith(expect.objectContaining({ barangay: 'Bigte' }));
    });

    it('rejects a batch payload missing the members array', async () => {
      const { batchFamilySchema } = await import('../src/intake/dto/intake.zod');
      const result = batchFamilySchema.safeParse({ primary: { surname: 'Dela Cruz', firstName: 'Juan' } } as any);
      expect(result.success).toBe(false);
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
      email: 'juan.delacruz@example.com',
        currentAddress: { street: '123 Purok 1', barangay: 'Bigte', city: 'Norzagaray', province: 'Bulacan', region: '03', postalCode: '3012' },
        occupation: 'Farmer',
        estimatedMonthlyIncome: 5000,
      },
      claimant: {
        surname: 'Claimant',
        firstName: 'Test',
        gender: 'Female',
        dob: '2000-01-01',
        placeOfBirth: 'Norzagaray, Bulacan',
        civilStatus: 'Single',
        cellularNumber: '09171234568',
        email: 'claimant@example.com',
        currentAddress: { street: '456 Purok 2', barangay: 'Bigte', city: 'Norzagaray', province: 'Bulacan', region: '03', postalCode: '3012' },
        occupation: 'Housewife',
        estimatedMonthlyIncome: 1,
        relationshipToBeneficiary: 'Spouse',
      },
      case: {},
    };
    const validResult = IntakeInputSchema.safeParse(minimalValid);
    expect(validResult.success).toBe(true);
  });
});
