import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BeneficiariesService } from '../src/beneficiaries/beneficiaries.service';
import { Person } from '../src/beneficiaries/person.entity';
import { Beneficiary } from '../src/beneficiaries/beneficiary.entity';
import { BeneficiaryClaimant } from '../src/beneficiaries/beneficiary-claimant.entity';
import { BeneficiaryRole } from '../src/beneficiaries/beneficiary-role.entity';
import { ConsentLedger } from '../src/beneficiaries/consent-ledger.entity';
import { HouseholdMembership } from '../src/beneficiaries/household-membership.entity';
import { Case } from '../src/cases/case.entity';

function createMockQb() {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
}

describe('BeneficiariesService — Trigram + BM25 Search', () => {
  let service: BeneficiariesService;
  let mockQb: ReturnType<typeof createMockQb>;

  beforeEach(async () => {
    mockQb = createMockQb();
    const benRepoMock = { createQueryBuilder: jest.fn().mockReturnValue(mockQb) } as any;

    const module = await Test.createTestingModule({
      providers: [
        BeneficiariesService,
        { provide: getRepositoryToken(Person), useValue: { find: jest.fn(), create: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(Beneficiary), useValue: benRepoMock },
        { provide: getRepositoryToken(BeneficiaryRole), useValue: { findOne: jest.fn(), update: jest.fn(), save: jest.fn(), create: jest.fn() } },
        { provide: getRepositoryToken(BeneficiaryClaimant), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(ConsentLedger), useValue: { find: jest.fn(), findOne: jest.fn() } },
        { provide: getRepositoryToken(HouseholdMembership), useValue: { find: jest.fn(), query: jest.fn() } },
        { provide: getRepositoryToken(Case), useValue: { find: jest.fn() } },
      ],
    }).compile();

    service = module.get<BeneficiariesService>(BeneficiariesService);
  });

  afterEach(() => jest.clearAllMocks());

  // Test 1: Typo tolerance — similarity() for long queries (>= 3 chars)
  it('should add similarity() conditions for search queries >= 3 chars', async () => {
    mockQb.getMany.mockResolvedValueOnce([]);
    await service.findAll(undefined, 'Dela Crus', 1, 100);

    expect(mockQb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('similarity(p.surname, :search) > 0.3'),
      expect.any(Object),
    );
    expect(mockQb.addSelect).toHaveBeenCalledWith(
      expect.stringContaining('ts_rank'),
      'rank',
    );
    expect(mockQb.orderBy).toHaveBeenCalledWith('rank', 'DESC');
  });

  // Test 2: Category filter — exact match filter
  it('should add br.category = :category filter when category param provided', async () => {
    mockQb.getMany.mockResolvedValueOnce([]);
    await service.findAll(undefined, undefined, 1, 100, 'Senior');

    expect(mockQb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('br.category = :category'),
      expect.objectContaining({ category: 'Senior' }),
    );
  });

  // Test 3: Barangay filter — existing behavior preserved
  it('should add barangay ILIKE filter when barangay param provided', async () => {
    mockQb.getMany.mockResolvedValueOnce([]);
    await service.findAll('Norzagaray', undefined, 1, 100);

    expect(mockQb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining(
        'EXISTS (SELECT 1 FROM person_addresses pa2 WHERE pa2.person_id = p.id AND (pa2.barangay ILIKE :barangay OR pa2.raw ILIKE :barangay))',
      ),
      expect.objectContaining({ barangay: expect.stringContaining('Norzagaray') }),
    );
  });

  // Test 4: Combined filters — barangay + search + category
  it('should apply barangay + search + category filters together', async () => {
    mockQb.getMany.mockResolvedValueOnce([]);
    await service.findAll('Norzagaray', 'Dela', 1, 100, 'Senior');

    // All three andWhere calls should have been made
    const andWhereCalls = (mockQb.andWhere as jest.Mock).mock.calls;
    const allArgs = andWhereCalls.map((c: string[]) => c[0]).join(' ');

    expect(allArgs).toContain('ILIKE :barangay');
    expect(allArgs).toContain('similarity(p.surname');
    expect(allArgs).toContain('br.category = :category');
  });

  // Test 5: Empty search — returns all beneficiaries
  it('should return all beneficiaries when no search, category, or barangay provided', async () => {
    mockQb.getManyAndCount.mockResolvedValueOnce([
      [
        { id: '1', surname: 'Cruz', firstName: 'Juan' },
        { id: '2', surname: 'Rosa', firstName: 'Maria' },
      ],
      2,
    ]);
    const results = await service.findAll(undefined, undefined, 1, 100);

    // addSelect should NOT have been called (no rank needed)
    expect(mockQb.addSelect).not.toHaveBeenCalled();
    // No search-related andWhere
    expect(mockQb.andWhere).not.toHaveBeenCalledWith(
      expect.stringContaining('plainto_tsquery'),
      expect.any(Object),
    );
    expect(results.data).toHaveLength(2);
    expect(results.total).toBe(2);
  });

  // Test 6: Short query guard — < 3 chars uses tsvector + ILIKE, NOT similarity
  it('should skip trigram similarity for short queries (< 3 chars)', async () => {
    mockQb.getMany.mockResolvedValueOnce([]);
    await service.findAll(undefined, 'Jo', 1, 100);

    const andWhereCalls = (mockQb.andWhere as jest.Mock).mock.calls;
    const allArgs = andWhereCalls.map((c: string[]) => c[0]).join(' ');

    // Should use plainto_tsquery and ILIKE, but NOT similarity()
    expect(allArgs).toContain('plainto_tsquery');
    expect(allArgs).toContain('ILIKE');
    expect(allArgs).not.toContain('similarity');
  });

  // Test 7: Relevance ranking — combined addSelect + orderBy
  it('should add combined relevance ranking with addSelect and orderBy', async () => {
    mockQb.getMany.mockResolvedValueOnce([]);
    await service.findAll(undefined, 'Dela Cruz', 1, 100);

    // addSelect with ts_rank + similarity combined score
    expect(mockQb.addSelect).toHaveBeenCalledWith(
      expect.stringContaining('ts_rank(p.search_vector, plainto_tsquery'),
      'rank',
    );
    // orderBy should use the rank alias
    expect(mockQb.orderBy).toHaveBeenCalledWith('rank', 'DESC');
  });
});
