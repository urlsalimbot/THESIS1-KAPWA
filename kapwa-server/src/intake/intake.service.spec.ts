import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, FindOperator, JsonContains } from 'typeorm';
import { IntakeService } from './intake.service';
import { Person } from '../beneficiaries/person.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { Household } from '../beneficiaries/household.entity';
import { HouseholdMembership } from '../beneficiaries/household-membership.entity';
import { Case, CaseStatus } from '../cases/case.entity';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity';
import { CasesService } from '../cases/cases.service';
import { batchFamilySchema, IntakeInputSchema } from './dto/intake.zod';
import type { BatchFamilyInput, IntakeInput } from './dto/intake.zod';

describe('IntakeService', () => {
  let service: IntakeService;
  let dataSourceMock: { createQueryRunner: jest.Mock; query: jest.Mock };
  let queryRunnerMock: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    query: jest.Mock;
    manager: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  };
  let caseRepo: { findOne: jest.Mock; create: jest.Mock };
  let benRepo: { findOne: jest.Mock; create: jest.Mock; find: jest.Mock };
  let hhRepo: { create: jest.Mock; findOne: jest.Mock };
  let personRepo: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock };
  let consentRepo: { create: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    queryRunnerMock = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue(undefined),
      manager: {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((_entity: unknown, data: unknown) => data),
        save: jest.fn().mockImplementation((entity: unknown, data?: unknown) =>
          Promise.resolve(data ?? entity),
        ),
      },
    };
    dataSourceMock = { createQueryRunner: jest.fn(() => queryRunnerMock), query: jest.fn() };
    caseRepo = { findOne: jest.fn(), create: jest.fn() };
    benRepo = { findOne: jest.fn(), create: jest.fn(), find: jest.fn() };
    hhRepo = { create: jest.fn(), findOne: jest.fn().mockResolvedValue(null) };
    personRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn((d: unknown) => ({ id: 'person-ana', ...(d as object) })),
    };
    consentRepo = { create: jest.fn(), save: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntakeService,
        { provide: DataSource, useValue: dataSourceMock },
        { provide: getRepositoryToken(Person), useValue: personRepo },
        { provide: getRepositoryToken(Beneficiary), useValue: benRepo },
        { provide: getRepositoryToken(Household), useValue: hhRepo },
        { provide: getRepositoryToken(HouseholdMembership), useValue: { create: jest.fn() } },
        { provide: getRepositoryToken(Case), useValue: caseRepo },
        { provide: getRepositoryToken(ConsentLedger), useValue: consentRepo },
        {
          provide: CasesService,
          useValue: { generateControlNo: jest.fn().mockResolvedValue('KAPWA-2026-00001') },
        },
      ],
    }).compile();

    service = module.get<IntakeService>(IntakeService);
    (service as unknown as { logger: { error: jest.Mock } }).logger = { error: jest.fn() };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const validIntakeInput: IntakeInput = {
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

  const validBatchInput: BatchFamilyInput = {
    caseId: 'case-1',
    primary: { surname: 'Dela Cruz', firstName: 'Juan', gender: 'Male', dob: '1990-01-01' },
    members: [
      { surname: 'Dela Cruz', firstName: 'Ana', gender: 'Female', dob: '1992-02-02', relationship: 'Spouse' },
    ],
  };

  describe('submitIntake', () => {
    const benUuid = 'ben-uuid-1';
    const hhUuid = 'hh-uuid-1';
    const caseUuid = 'case-uuid-1';
    const clUuid = 'cl-uuid-1';
    const claimUuid = 'claim-uuid-1';
    const bcUuid = 'bc-uuid-1';

    function mockSaveSequence() {
      return queryRunnerMock.manager.save as jest.Mock;
    }

    function stubCreates() {
      (personRepo.create as jest.Mock).mockReturnValue({});
      (benRepo.create as jest.Mock).mockReturnValue({});
      (hhRepo.create as jest.Mock).mockReturnValue({});
      (caseRepo.create as jest.Mock).mockReturnValue({});
      (consentRepo.create as jest.Mock).mockReturnValue({});
    }

    it('should create Person + Beneficiary + Claimant + HouseholdMemberships + Case + ConsentLedger on successful intake', async () => {
      const saveMock = mockSaveSequence();
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

      stubCreates();

      const result = await service.submitIntake(validIntakeInput, 'caller-1');

      expect(queryRunnerMock.startTransaction).toHaveBeenCalledWith('SERIALIZABLE');
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
      expect(queryRunnerMock.rollbackTransaction).not.toHaveBeenCalled();
      expect(queryRunnerMock.release).toHaveBeenCalled();

      expect(result).toHaveProperty('beneficiaryId', benUuid);
      expect(result).toHaveProperty('caseId', caseUuid);
      expect(result).toHaveProperty('controlNo', 'KAPWA-2026-00001');
      expect(result).toHaveProperty('status', CaseStatus.ENROLLED);

      expect(caseRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          assignedWorkerId: 'caller-1',
          controlNo: 'KAPWA-2026-00001',
          status: CaseStatus.ENROLLED,
        }),
      );
    });

    it('should return control_no in KAPWA-YYYY-XXXXX format', async () => {
      const saveMock = mockSaveSequence();
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

      stubCreates();

      const result = await service.submitIntake(validIntakeInput, 'caller-1');
      expect(result.controlNo).toMatch(/^KAPWA-\d{4}-\d{5}$/);
    });

    it('should store the beneficiary surname value', async () => {
      const saveMock = mockSaveSequence();
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

      stubCreates();

      await service.submitIntake(validIntakeInput, 'caller-1');

      expect(personRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ surname: 'Dela Cruz' })
      );
      expect(benRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ consentStatus: 'active' })
      );
    });

    it('should rollback all entities if case creation fails', async () => {
      const saveMock = mockSaveSequence();
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

      stubCreates();

      await expect(service.submitIntake(validIntakeInput, 'caller-1')).rejects.toThrow('Service temporarily unavailable');

      expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunnerMock.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunnerMock.release).toHaveBeenCalled();
    });
  });

  describe('matchCheck', () => {
    it('should call dataSource.query with surname and firstName', async () => {
      dataSourceMock.query = jest.fn().mockResolvedValue([]);

      await service.matchCheck(
        { surname: 'Dela Cruz', firstName: 'Juan', familyMembers: [] },
        [],
      );

      expect(dataSourceMock.query).toHaveBeenCalledWith(
        expect.stringContaining('similarity'),
        ['Dela Cruz', 'Juan', null],
      );
    });

    it('should return empty candidates when no matches', async () => {
      dataSourceMock.query = jest.fn().mockResolvedValue([]);

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
        service.confirmMatch('nonexistent-id', validIntakeInput, [], 'caller-1'),
      ).rejects.toThrow('Household not found');
    });

    it('should throw ForbiddenException if worker not permitted for barangay', async () => {
      hhRepo.findOne = jest.fn().mockResolvedValue({ id: 'hh-id', barangay: 'Bigte' }) as any;

      await expect(
        service.confirmMatch('hh-id', validIntakeInput, ['Matictic'], 'caller-1'),
      ).rejects.toThrow('You do not have permission for this barangay');
    });

    it('should create beneficiary with existing householdId on confirm', async () => {
      hhRepo.findOne = jest.fn().mockResolvedValue({ id: 'existing-hh', barangay: 'Bigte' }) as any;
      benRepo.find = jest.fn().mockResolvedValue([{ id: 'existing-ben' }]) as any;

      const saveMock = queryRunnerMock.manager.save as jest.Mock;
      saveMock
        .mockResolvedValueOnce({ id: 'person-uuid' })
        .mockResolvedValueOnce({ id: 'new-ben-id' })
        .mockResolvedValueOnce({ id: 'claim-uuid' })
        .mockResolvedValueOnce({ id: 'bc-uuid' })
        .mockResolvedValueOnce({ id: 'fm-person-1' })
        .mockResolvedValueOnce({ id: 'hm-uuid-1' })
        .mockResolvedValueOnce({ id: 'new-case-id', controlNo: 'KAPWA-2026-00001' })
        .mockResolvedValueOnce({ id: 'cl-1' });

      (personRepo.create as jest.Mock).mockReturnValue({});
      (benRepo.create as jest.Mock).mockReturnValue({});
      (hhRepo.create as jest.Mock).mockReturnValue({});
      (caseRepo.create as jest.Mock).mockReturnValue({});
      (consentRepo.create as jest.Mock).mockReturnValue({});

      caseRepo.findOne = jest.fn().mockResolvedValue(null) as any;

      const result = await service.confirmMatch('existing-hh', validIntakeInput, ['Bigte'], 'caller-1');

      expect(queryRunnerMock.manager.create).toHaveBeenCalledWith(
        Beneficiary,
        expect.objectContaining({ householdId: 'existing-hh' }),
      );
      expect(result).toHaveProperty('beneficiaryId', 'new-ben-id');
      expect(result).toHaveProperty('status', CaseStatus.ENROLLED);

      expect(caseRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ assignedWorkerId: 'caller-1' }),
      );
    });
  });

  describe('family member person build', () => {
    it('should save the member person with gender, dob, and computed age', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 6, 31, 12));

      const saveMock = queryRunnerMock.manager.save as jest.Mock;
      // save order: Person(ben), Beneficiary, Person(claimant), BeneficiaryClaimant, Household, Beneficiary(update), Person(FM), HouseholdMembership, Case, ConsentLedger
      saveMock
        .mockResolvedValueOnce({ id: 'person-uuid-1' })
        .mockResolvedValueOnce({ id: 'ben-uuid-1' })
        .mockResolvedValueOnce({ id: 'claim-uuid' })
        .mockResolvedValueOnce({ id: 'bc-uuid' })
        .mockResolvedValueOnce({ id: 'hh-uuid' })
        .mockResolvedValueOnce({ id: 'ben-uuid-1', householdId: 'hh-uuid' })
        .mockResolvedValueOnce({ id: 'fm-person-1' })
        .mockResolvedValueOnce({ id: 'hm-uuid-1' })
        .mockResolvedValueOnce({ id: 'case-uuid' })
        .mockResolvedValueOnce({ id: 'cl-uuid' });

      (personRepo.create as jest.Mock).mockImplementation((data: any) => data);
      (benRepo.create as jest.Mock).mockReturnValue({});
      (hhRepo.create as jest.Mock).mockReturnValue({});
      (caseRepo.create as jest.Mock).mockReturnValue({});
      (consentRepo.create as jest.Mock).mockReturnValue({});

      try {
        await service.submitIntake({
          ...validIntakeInput,
          familyMembers: [
            { surname: 'Dela Cruz', firstName: 'Jose', gender: 'Female', dob: '2010-06-15', relationship: 'Child' },
          ],
        }, 'caller-1');

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

  describe('validation', () => {
    it('should reject invalid IntakeInput via Zod schema validation', () => {
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

    it('rejects a batch payload missing the members array', () => {
      const result = batchFamilySchema.safeParse({
        caseId: 'case-1',
        primary: { surname: 'Dela Cruz', firstName: 'Juan' },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('submitBatchFamily', () => {
    function seedExistingRecords() {
      caseRepo.findOne.mockResolvedValue({
        id: 'case-1',
        beneficiaryId: 'ben-1',
        controlNo: 'NC-2026-0001',
        status: 'enrolled',
      });
      benRepo.findOne.mockResolvedValue({ id: 'ben-1', householdId: 'household-1' });
    }

    function membershipSaves() {
      return queryRunnerMock.manager.save.mock.calls.filter(
        (call) =>
          call[0] &&
          typeof call[0] === 'object' &&
          (call[0] as { householdId?: string }).householdId === 'household-1',
      );
    }

    it('throws BadRequestException when the primary is missing required fields', async () => {
      await expect(
        service.submitBatchFamily({ caseId: 'case-1', primary: { surname: 'Dela Cruz' }, members: [] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException when the case does not exist', async () => {
      caseRepo.findOne.mockResolvedValue(null);
      await expect(service.submitBatchFamily(validBatchInput)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException when the case is not linked to a beneficiary', async () => {
      caseRepo.findOne.mockResolvedValue({
        id: 'case-1',
        beneficiaryId: null,
        controlNo: 'NC-2026-0001',
        status: 'enrolled',
      });
      await expect(service.submitBatchFamily(validBatchInput)).rejects.toBeInstanceOf(BadRequestException);
      expect(benRepo.findOne).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the beneficiary has no household', async () => {
      caseRepo.findOne.mockResolvedValue({
        id: 'case-1',
        beneficiaryId: 'ben-1',
        controlNo: 'NC-2026-0001',
        status: 'enrolled',
      });
      benRepo.findOne.mockResolvedValue({ id: 'ben-1', householdId: null });
      await expect(service.submitBatchFamily(validBatchInput)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('does NOT create a new Beneficiary, Household, or Case', async () => {
      seedExistingRecords();
      await service.submitBatchFamily(validBatchInput);
      expect(benRepo.create).not.toHaveBeenCalled();
      expect(hhRepo.create).not.toHaveBeenCalled();
      expect(caseRepo.create).not.toHaveBeenCalled();
    });

    it('links members to the primary existing household and returns the existing caseId', async () => {
      seedExistingRecords();
      const result = await service.submitBatchFamily(validBatchInput);
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
      expect(queryRunnerMock.rollbackTransaction).not.toHaveBeenCalled();
      expect(result.caseId).toBe('case-1');
      expect(result.beneficiaryId).toBe('ben-1');
      expect(result.controlNo).toBe('NC-2026-0001');
      expect(result.status).toBe('enrolled');
      const saves = membershipSaves();
      expect(saves).toHaveLength(1);
      expect(saves[0][0]).toMatchObject({
        personId: 'person-ana',
        householdId: 'household-1',
        relationship: 'Spouse',
        isPrimary: false,
      });
    });

    it('is idempotent: does not re-create the member person or duplicate the membership when already linked', async () => {
      seedExistingRecords();
      queryRunnerMock.manager.findOne
        .mockResolvedValueOnce({ id: 'person-ana' })
        .mockResolvedValueOnce({ id: 'membership-1', personId: 'person-ana', householdId: 'household-1' });
      const result = await service.submitBatchFamily(validBatchInput);
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
      expect(result.caseId).toBe('case-1');
      expect(personRepo.create).not.toHaveBeenCalled();
      expect(membershipSaves()).toHaveLength(0);
    });

    it('scopes the member dedup lookup to the primary household barangay', async () => {
      seedExistingRecords();
      (hhRepo.findOne as jest.Mock).mockResolvedValue({ id: 'household-1', barangay: 'Bigte' });
      await service.submitBatchFamily(validBatchInput);
      const [entity, options] = queryRunnerMock.manager.findOne.mock.calls[0];
      expect(entity).toBe(Person);
      expect(options.where).toMatchObject({ surname: 'Dela Cruz', firstName: 'Ana' });
      expect(options.where.currentAddress).toBeInstanceOf(FindOperator);
      expect(options.where.currentAddress.type).toBe('jsonContains');
      expect(options.where.currentAddress.value).toEqual({ barangay: 'Bigte' });
    });

    it('falls back to an unscoped dedup lookup when the household has no barangay', async () => {
      seedExistingRecords();
      (hhRepo.findOne as jest.Mock).mockResolvedValue({ id: 'household-1', barangay: '' });
      await service.submitBatchFamily(validBatchInput);
      const [entity, options] = queryRunnerMock.manager.findOne.mock.calls[0];
      expect(entity).toBe(Person);
      expect(options.where.currentAddress).toBeUndefined();
    });

    it('surfaces a generic message on batch failure, not the raw error', async () => {
      seedExistingRecords();
      queryRunnerMock.manager.save.mockRejectedValue(
        new Error('ERROR: column person.currentaddress does not exist'),
      );
      await expect(service.submitBatchFamily(validBatchInput)).rejects.toThrow(
        'Service temporarily unavailable',
      );
    });

    it('generates column-safe SQL for the barangay-scoped dedup lookup', async () => {
      const dataSource = new DataSource({ type: 'postgres', entities: [Person] });
      await (dataSource as any).buildMetadatas();
      const repo = dataSource.getRepository(Person);
      const sql = repo
        .createQueryBuilder('person')
        .where({ currentAddress: JsonContains({ barangay: 'Bigte' }) })
        .getSql();
      expect(sql).toContain('"person"."current_address" ::jsonb @>');
      expect(sql).not.toContain('currentAddress');
    });
  });
});
