import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { IntakeService } from './intake.service';
import { Person } from '../beneficiaries/person.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { Household } from '../beneficiaries/household.entity';
import { Case } from '../cases/case.entity';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity';
import { CasesService } from '../cases/cases.service';

describe('IntakeService.submitBatchFamily', () => {
  let service: IntakeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntakeService,
        { provide: DataSource, useValue: { createQueryRunner: jest.fn() } },
        { provide: getRepositoryToken(Person), useValue: {} },
        { provide: getRepositoryToken(Beneficiary), useValue: {} },
        { provide: getRepositoryToken(Household), useValue: {} },
        { provide: getRepositoryToken(Case), useValue: {} },
        { provide: getRepositoryToken(ConsentLedger), useValue: {} },
        { provide: CasesService, useValue: { generateControlNo: jest.fn() } },
      ],
    }).compile();

    service = module.get<IntakeService>(IntakeService);
  });

  it('throws BadRequestException when the primary is missing required fields', async () => {
    await expect(
      service.submitBatchFamily({ primary: { surname: 'Dela Cruz' }, members: [] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not delegate to submitIntake when required fields are missing', async () => {
    const spy = jest.spyOn(service, 'submitIntake');
    await expect(
      service.submitBatchFamily({ primary: { firstName: 'Juan' }, members: [] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(spy).not.toHaveBeenCalled();
  });

  it('delegates to submitIntake when the primary has required fields', async () => {
    const spy = jest.spyOn(service, 'submitIntake').mockResolvedValue({
      beneficiaryId: 'ben-1',
      caseId: 'case-1',
      controlNo: 'NC-2026-0001',
      status: 'ENROLLED',
    });
    const result = await service.submitBatchFamily({
      primary: { surname: 'Dela Cruz', firstName: 'Juan', gender: 'Male', dob: '1990-01-01' },
      members: [],
    });
    expect(spy).toHaveBeenCalled();
    expect(result.controlNo).toBe('NC-2026-0001');
  });
});
