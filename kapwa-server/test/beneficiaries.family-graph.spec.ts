import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { BeneficiariesService } from '../src/beneficiaries/beneficiaries.service';
import { Person } from '../src/beneficiaries/person.entity';
import { HouseholdMembership } from '../src/beneficiaries/household-membership.entity';
import { BeneficiaryClaimant } from '../src/beneficiaries/beneficiary-claimant.entity';
import { Beneficiary } from '../src/beneficiaries/beneficiary.entity';
import { BeneficiaryRole } from '../src/beneficiaries/beneficiary-role.entity';
import { ConsentLedger } from '../src/beneficiaries/consent-ledger.entity';
import { Case } from '../src/cases/case.entity';

describe('BeneficiariesService — Family Graph', () => {
  let service: BeneficiariesService;
  let hmRepo: Repository<HouseholdMembership>;
  let benRepo: Repository<Beneficiary>;

  const mockBen = { id: 'ben-1', householdId: 'hh-1', personId: 'person-1' } as Beneficiary;
  const mockPerson = { id: 'person-1', surname: 'Cruz', firstName: 'Juan', middleName: null, age: 45, occupation: 'Employed', estimatedMonthlyIncome: 30000 };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BeneficiariesService,
        {
          provide: getRepositoryToken(Beneficiary),
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockBen),
            update: jest.fn().mockResolvedValue({}),
            create: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(BeneficiaryRole),
          useValue: {
            findOne: jest.fn(),
            update: jest.fn().mockResolvedValue({}),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ConsentLedger),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue(null),
            save: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: getRepositoryToken(Person),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn().mockResolvedValue(mockPerson),
          },
        },
        {
          provide: getRepositoryToken(HouseholdMembership),
          useValue: {
            find: jest.fn(),
            query: jest.fn(),
          },
        },
        { provide: getRepositoryToken(BeneficiaryClaimant), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(Case), useValue: { find: jest.fn().mockResolvedValue([]) } },
      ],
    }).compile();

    service = module.get<BeneficiariesService>(BeneficiariesService);
    hmRepo = module.get<Repository<HouseholdMembership>>(getRepositoryToken(HouseholdMembership));
    benRepo = module.get<Repository<Beneficiary>>(getRepositoryToken(Beneficiary));
  });

  afterEach(() => jest.clearAllMocks());

  it('should return primary and household members', async () => {
    const mockMembers = [
      { id: 'fm-2', full_name: 'Maria Cruz', relationship: 'Spouse', age: 42, occupation: 'Housewife', income: 0, status: null, is_primary: false },
    ];

    (hmRepo.query as jest.Mock).mockResolvedValue(mockMembers);

    const result = await service.getFamilyGraph('ben-1');

    expect(hmRepo.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT hm.id'),
      expect.arrayContaining(['hh-1', expect.any(Number)]),
    );
    expect(result.primary?.fullName).toContain('Juan Cruz');
    expect(result.primary?.relationship).toBe('Self');
    expect(result.members).toHaveLength(2);
    expect(result.totalCount).toBe(2);
  });

  it('should return all members with depth 0', async () => {
    const mockMembers = [
      { id: 'fm-2', full_name: 'Pedro Cruz', relationship: 'Sibling', age: 40, occupation: 'Self-employed', income: 0, status: null, is_primary: false },
    ];

    (hmRepo.query as jest.Mock).mockResolvedValue(mockMembers);

    const result = await service.getFamilyGraph('ben-1');

    const depths = result.members.map((m: any) => m.depth);
    expect(depths).toEqual([0, 0]);
  });

  it('should throw NotFoundException for non-existent beneficiary', async () => {
    (benRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.getFamilyGraph('nonexistent')).rejects.toThrow(NotFoundException);
  });

  it('should return empty when beneficiary has no household', async () => {
    (benRepo.findOne as jest.Mock).mockResolvedValue({ id: 'ben-2', householdId: null, personId: 'person-2' } as any);

    const result = await service.getFamilyGraph('ben-2');

    expect(result.primary).toBeNull();
    expect(result.members).toHaveLength(0);
    expect(result.totalCount).toBe(0);
  });

  it('should LIMIT results to prevent runaway queries', async () => {
    const manyMembers = Array.from({ length: 60 }, (_, i) => ({
      id: `fm-${i}`,
      full_name: `Member ${i}`,
      relationship: 'Relative',
      age: 30,
      income: 0,
      status: null,
      is_primary: false,
    }));

    (hmRepo.query as jest.Mock).mockResolvedValue(manyMembers.slice(0, 50));

    const result = await service.getFamilyGraph('ben-1');

    expect(hmRepo.query).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([expect.any(String), 50]),
    );
    expect(result.totalCount).toBeLessThanOrEqual(51);
  });
});
