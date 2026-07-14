import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { BeneficiariesService } from '../src/beneficiaries/beneficiaries.service';
import { Beneficiary } from '../src/beneficiaries/beneficiary.entity';
import { ConsentLedger } from '../src/beneficiaries/consent-ledger.entity';
import { FamilyMember } from '../src/beneficiaries/family-member.entity';
import { Case } from '../src/cases/case.entity';
import { Intervention } from '../src/interventions/intervention.entity';

describe('BeneficiariesService — Family Graph (Recursive CTE)', () => {
  let service: BeneficiariesService;
  let familyMemberRepo: Repository<FamilyMember>;
  let benRepo: Repository<Beneficiary>;

  const mockBen: Partial<Beneficiary> = { id: 'ben-1', householdId: 'hh-1' };

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
          provide: getRepositoryToken(ConsentLedger),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue(null),
            save: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: getRepositoryToken(FamilyMember),
          useValue: {
            find: jest.fn(),
            query: jest.fn(),
          },
        },
        { provide: getRepositoryToken(Case), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: getRepositoryToken(Intervention), useValue: { find: jest.fn().mockResolvedValue([]) } },
      ],
    }).compile();

    service = module.get<BeneficiariesService>(BeneficiariesService);
    familyMemberRepo = module.get<Repository<FamilyMember>>(getRepositoryToken(FamilyMember));
    benRepo = module.get<Repository<Beneficiary>>(getRepositoryToken(Beneficiary));
  });

  afterEach(() => jest.clearAllMocks());

  // Test 1: Returns members from same household (depth 0)
  it('should return family members from the same household (depth 0)', async () => {
    const mockMembers = [
      { id: 'fm-1', fullName: 'Juan Cruz', relationship: 'Self', age: 45, occupation: 'Employed', isPrimary: true, depth: 0 },
      { id: 'fm-2', fullName: 'Maria Cruz', relationship: 'Spouse', age: 42, occupation: 'Housewife', isPrimary: false, depth: 0 },
    ];

    (familyMemberRepo.query as jest.Mock).mockResolvedValue(mockMembers);

    const result = await service.getFamilyGraph('ben-1');

    expect(familyMemberRepo.query).toHaveBeenCalledWith(
      expect.stringContaining('WITH RECURSIVE family_tree'),
      expect.arrayContaining(['ben-1', expect.any(Number)]),
    );
    expect(result.primary).toEqual(mockMembers[0]);
    expect(result.members).toHaveLength(2);
    expect(result.totalCount).toBe(2);
  });

  // Test 2: Returns cross-household members up to depth 2
  it('should return cross-household members up to depth 2', async () => {
    const mockMembers = [
      { id: 'fm-1', fullName: 'Juan Cruz', relationship: 'Self', age: 45, occupation: 'Employed', isPrimary: true, depth: 0 },
      { id: 'fm-3', fullName: 'Pedro Cruz', relationship: 'Sibling', age: 40, occupation: 'Self-employed', isPrimary: false, depth: 1 },
      { id: 'fm-4', fullName: 'Ana Cruz', relationship: 'Niece', age: 20, occupation: 'Student', isPrimary: false, depth: 2 },
    ];

    (familyMemberRepo.query as jest.Mock).mockResolvedValue(mockMembers);

    const result = await service.getFamilyGraph('ben-1');

    const depths = result.members.map((m: any) => m.depth);
    expect(depths).toContain(0);
    expect(depths).toContain(1);
    expect(depths).toContain(2);
    expect(Math.max(...depths)).toBeLessThanOrEqual(2);
  });

  // Test 3: Excludes members whose linked beneficiary has revoked consent
  it('should exclude members from households where consent is revoked', async () => {
    (familyMemberRepo.query as jest.Mock).mockResolvedValue([
      { id: 'fm-1', fullName: 'Juan Cruz', relationship: 'Self', age: 45, isPrimary: true, depth: 0 },
    ]);

    const result = await service.getFamilyGraph('ben-1');

    expect(familyMemberRepo.query).toHaveBeenCalledWith(
      expect.stringContaining("consent_status = 'active'"),
      expect.any(Array),
    );
  });

  // Test 4: Returns empty for non-existent beneficiary
  it('should throw NotFoundException for non-existent beneficiary', async () => {
    (benRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.getFamilyGraph('nonexistent')).rejects.toThrow(NotFoundException);
  });

  // Test 5: Limits results to FAMILY_MEMBER_LIMIT
  it('should LIMIT results to prevent runaway queries', async () => {
    const manyMembers = Array.from({ length: 60 }, (_, i) => ({
      id: `fm-${i}`,
      fullName: `Member ${i}`,
      relationship: 'Relative',
      age: 30,
      isPrimary: false,
      depth: 0,
    }));

    (familyMemberRepo.query as jest.Mock).mockResolvedValue(manyMembers.slice(0, 50));

    const result = await service.getFamilyGraph('ben-1');

    expect(familyMemberRepo.query).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([expect.any(String), 50]),
    );
    expect(result.totalCount).toBeLessThanOrEqual(50);
  });
});
