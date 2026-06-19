import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BeneficiariesService } from '../src/beneficiaries/beneficiaries.service';
import { Beneficiary } from '../src/beneficiaries/beneficiary.entity';
import { ConsentLedger } from '../src/beneficiaries/consent-ledger.entity';
import { FamilyMember } from '../src/beneficiaries/family-member.entity';
import { Case } from '../src/cases/case.entity';
import { Intervention } from '../src/interventions/intervention.entity';

function createMockQb() {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
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
        { provide: getRepositoryToken(Beneficiary), useValue: benRepoMock },
        { provide: getRepositoryToken(ConsentLedger), useValue: { find: jest.fn(), findOne: jest.fn() } },
        { provide: getRepositoryToken(FamilyMember), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(Case), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(Intervention), useValue: { find: jest.fn() } },
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
      expect.stringContaining('similarity(b.surname, :search) > 0.3'),
      expect.any(Object),
    );
    expect(mockQb.addSelect).toHaveBeenCalledWith(
      expect.stringContaining('ts_rank'),
      'rank',
    );
    expect(mockQb.orderBy).toHaveBeenCalledWith('rank', 'DESC');
  });

  // Test 2: Category filter — exact match filter
  it('should add b.category = :category filter when category param provided', async () => {
    mockQb.getMany.mockResolvedValueOnce([]);
    await service.findAll(undefined, undefined, 1, 100, 'Senior');

    expect(mockQb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('b.category = :category'),
      expect.objectContaining({ category: 'Senior' }),
    );
  });

  // Test 3: Barangay filter — existing behavior preserved
  it('should add barangay ILIKE filter when barangay param provided', async () => {
    mockQb.getMany.mockResolvedValueOnce([]);
    await service.findAll('Norzagaray', undefined, 1, 100);

    expect(mockQb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('b.address ILIKE :barangay'),
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
    expect(allArgs).toContain('similarity(b.surname');
    expect(allArgs).toContain('b.category = :category');
  });

  // Test 5: Empty search — returns all beneficiaries
  it('should return all beneficiaries when no search, category, or barangay provided', async () => {
    mockQb.getMany.mockResolvedValueOnce([
      { id: '1', surname: 'Cruz', firstName: 'Juan' },
      { id: '2', surname: 'Rosa', firstName: 'Maria' },
    ]);
    const results = await service.findAll(undefined, undefined, 1, 100);

    // addSelect should NOT have been called (no rank needed)
    expect(mockQb.addSelect).not.toHaveBeenCalled();
    // No search-related andWhere
    expect(mockQb.andWhere).not.toHaveBeenCalledWith(
      expect.stringContaining('plainto_tsquery'),
      expect.any(Object),
    );
    expect(results).toHaveLength(2);
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
      expect.stringContaining('ts_rank(b.search_vector, plainto_tsquery'),
      'rank',
    );
    // orderBy should use the rank alias
    expect(mockQb.orderBy).toHaveBeenCalledWith('rank', 'DESC');
  });
});
