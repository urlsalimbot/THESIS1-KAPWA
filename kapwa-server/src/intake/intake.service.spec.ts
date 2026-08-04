import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { IntakeService } from './intake.service';
import { Person } from '../beneficiaries/person.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { Household } from '../beneficiaries/household.entity';
import { HouseholdMembership } from '../beneficiaries/household-membership.entity';
import { Case } from '../cases/case.entity';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity';
import { CasesService } from '../cases/cases.service';
import type { BatchFamilyInput } from './dto/intake.zod';

describe('IntakeService.submitBatchFamily', () => {
  let service: IntakeService;
  let queryRunnerMock: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    manager: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  };
  let caseRepo: { findOne: jest.Mock; create: jest.Mock };
  let benRepo: { findOne: jest.Mock; create: jest.Mock };
  let hhRepo: { create: jest.Mock };
  let personRepo: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock };

  beforeEach(async () => {
    queryRunnerMock = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((_entity: unknown, data: unknown) => data),
        save: jest.fn().mockImplementation((entity: unknown, data?: unknown) =>
          Promise.resolve(data ?? entity),
        ),
      },
    };
    caseRepo = { findOne: jest.fn(), create: jest.fn() };
    benRepo = { findOne: jest.fn(), create: jest.fn() };
    hhRepo = { create: jest.fn() };
    personRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn((d: unknown) => ({ id: 'person-ana', ...(d as object) })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntakeService,
        { provide: DataSource, useValue: { createQueryRunner: jest.fn(() => queryRunnerMock) } },
        { provide: getRepositoryToken(Person), useValue: personRepo },
        { provide: getRepositoryToken(Beneficiary), useValue: benRepo },
        { provide: getRepositoryToken(Household), useValue: hhRepo },
        { provide: getRepositoryToken(HouseholdMembership), useValue: { create: jest.fn() } },
        { provide: getRepositoryToken(Case), useValue: caseRepo },
        { provide: getRepositoryToken(ConsentLedger), useValue: {} },
        { provide: CasesService, useValue: { generateControlNo: jest.fn() } },
      ],
    }).compile();

    service = module.get<IntakeService>(IntakeService);
  });

  const validInput: BatchFamilyInput = {
    caseId: 'case-1',
    primary: { surname: 'Dela Cruz', firstName: 'Juan', gender: 'Male', dob: '1990-01-01' },
    members: [
      { surname: 'Dela Cruz', firstName: 'Ana', gender: 'Female', dob: '1992-02-02', relationship: 'Spouse' },
    ],
  };

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
    await expect(service.submitBatchFamily(validInput)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws BadRequestException when the beneficiary has no household', async () => {
    caseRepo.findOne.mockResolvedValue({
      id: 'case-1',
      beneficiaryId: 'ben-1',
      controlNo: 'NC-2026-0001',
      status: 'enrolled',
    });
    benRepo.findOne.mockResolvedValue({ id: 'ben-1', householdId: null });
    await expect(service.submitBatchFamily(validInput)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does NOT create a new Beneficiary, Household, or Case', async () => {
    seedExistingRecords();
    await service.submitBatchFamily(validInput);
    expect(benRepo.create).not.toHaveBeenCalled();
    expect(hhRepo.create).not.toHaveBeenCalled();
    expect(caseRepo.create).not.toHaveBeenCalled();
  });

  it('links members to the primary existing household and returns the existing caseId', async () => {
    seedExistingRecords();
    const result = await service.submitBatchFamily(validInput);
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

  it('is idempotent: does not create a duplicate membership when the member is already linked', async () => {
    seedExistingRecords();
    queryRunnerMock.manager.findOne
      .mockResolvedValueOnce({ id: 'person-ana' })
      .mockResolvedValueOnce({ id: 'membership-1', personId: 'person-ana', householdId: 'household-1' });
    await service.submitBatchFamily(validInput);
    expect(membershipSaves()).toHaveLength(0);
  });
});
