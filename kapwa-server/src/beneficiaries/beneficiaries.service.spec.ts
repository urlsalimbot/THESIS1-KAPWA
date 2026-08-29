import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BeneficiariesService } from './beneficiaries.service';
import { Person } from './person.entity';
import { Beneficiary } from './beneficiary.entity';
import { BeneficiaryRole } from './beneficiary-role.entity';
import { BeneficiaryClaimant } from './beneficiary-claimant.entity';
import { ConsentLedger } from './consent-ledger.entity';
import { HouseholdMembership } from './household-membership.entity';
import { Case } from '../cases/case.entity';

describe('BeneficiariesService', () => {
  let service: BeneficiariesService;
  let personRepoMock: any;
  let benRepoMock: any;
  let consentRepoMock: any;

  beforeEach(async () => {
    personRepoMock = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    benRepoMock = { create: jest.fn(), save: jest.fn(), findOne: jest.fn() };
    consentRepoMock = { save: jest.fn(), findOne: jest.fn(), find: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BeneficiariesService,
        { provide: getRepositoryToken(Person), useValue: personRepoMock },
        { provide: getRepositoryToken(Beneficiary), useValue: benRepoMock },
        { provide: getRepositoryToken(BeneficiaryRole), useValue: { findOne: jest.fn().mockResolvedValue(null), create: jest.fn((d: any) => d), save: jest.fn(async (d: any) => ({ id: 'role-1', ...d })) } },
        { provide: getRepositoryToken(BeneficiaryClaimant), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(ConsentLedger), useValue: consentRepoMock },
        { provide: getRepositoryToken(HouseholdMembership), useValue: { query: jest.fn() } },
        { provide: getRepositoryToken(Case), useValue: { find: jest.fn(), findOne: jest.fn() } },
      ],
    }).compile();
    service = module.get<BeneficiariesService>(BeneficiariesService);
  });

  describe('createBeneficiary', () => {
    const baseData = {
      surname: 'Dela Cruz',
      firstName: 'Juan',
      gender: 'Male',
      dob: new Date('2000-01-01'),
      philsysNumber: '1234-5678-9012',
    };

    it('reuses an existing person when philsysNumber matches (no duplicate)', async () => {
      personRepoMock.findOne.mockResolvedValue({ id: 'person-existing', philsysNumber: '1234-5678-9012' });
      benRepoMock.create.mockImplementation((dto: any) => dto);
      benRepoMock.save.mockImplementation(async (dto: any) => ({ id: 'ben-1', ...dto }));
      consentRepoMock.save.mockResolvedValue({ id: 'c1' });

      const result = await service.createBeneficiary(baseData);

      expect(personRepoMock.findOne).toHaveBeenCalledWith({ where: { philsysNumber: '1234-5678-9012' } });
      expect(personRepoMock.save).not.toHaveBeenCalled();
      expect(result.personId).toBe('person-existing');
    });

    it('creates a new person when philsysNumber is new', async () => {
      personRepoMock.findOne.mockResolvedValue(null);
      personRepoMock.create.mockImplementation((dto: any) => dto);
      personRepoMock.save.mockImplementation(async (dto: any) => ({ id: 'person-new', ...dto }));
      benRepoMock.create.mockImplementation((dto: any) => dto);
      benRepoMock.save.mockImplementation(async (dto: any) => ({ id: 'ben-2', ...dto }));
      consentRepoMock.save.mockResolvedValue({ id: 'c2' });

      const result = await service.createBeneficiary(baseData);

      expect(personRepoMock.findOne).toHaveBeenCalled();
      expect(personRepoMock.save).toHaveBeenCalledTimes(1);
      expect(result.personId).toBe('person-new');
    });
  });
});
