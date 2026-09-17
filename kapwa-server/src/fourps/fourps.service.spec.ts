import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { FourPsService, ageFromDob } from './fourps.service';
import { CaseComplianceItem } from './fourps-compliance.entity';
import { CasePayout } from './fourps-payout.entity';

describe('ageFromDob', () => {
  it('computes full years with birthday awareness', () => {
    const now = new Date('2026-09-17T00:00:00Z');
    expect(ageFromDob('2015-09-18', now)).toBe(10);
    expect(ageFromDob('2015-09-17', now)).toBe(11);
    expect(ageFromDob(null, now)).toBe(0);
  });
});

describe('FourPsService.generateComplianceItems', () => {
  let service: FourPsService;
  let repoMock: any;
  let payoutRepoMock: any;

  const yearsAgo = (years: number) => new Date(Date.now() - years * 365.25 * 86400000).toISOString().slice(0, 10);

  beforeEach(async () => {
    repoMock = { query: jest.fn(), find: jest.fn(), findOne: jest.fn(), save: jest.fn(), create: jest.fn((d: any) => d) };
    payoutRepoMock = { query: jest.fn(), find: jest.fn(), findOne: jest.fn(), save: jest.fn(), create: jest.fn((d: any) => d) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FourPsService,
        { provide: getRepositoryToken(CaseComplianceItem), useValue: repoMock },
        { provide: getRepositoryToken(CasePayout), useValue: payoutRepoMock },
      ],
    }).compile();
    service = module.get(FourPsService);
  });

  function mockGeneration(insertReturnsOne = true) {
    repoMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT b.household_id')) return [{ household_id: 'h1' }];
      if (sql.includes('access_card_code FROM households')) return [{ access_card_code: 'NORZ-AC-2026-0001' }];
      if (sql.includes('FROM household_memberships')) {
        return [
          { person_id: 'p-kid', gender: 'Male', dob: yearsAgo(10), relationship: 'Child', is_primary: false },
          { person_id: 'p-baby', gender: 'Female', dob: yearsAgo(1), relationship: 'Child', is_primary: false },
          { person_id: 'p-mom', gender: 'Female', dob: yearsAgo(40), relationship: 'Spouse', is_primary: false },
          { person_id: 'p-head', gender: 'Male', dob: yearsAgo(45), relationship: 'Head', is_primary: true },
        ];
      }
      if (sql.includes('INSERT INTO case_compliance_items')) return insertReturnsOne ? [{ id: 'new' }] : [];
      return [];
    });
  }

  it('creates per-member conditionality items for the next 12 months', async () => {
    mockGeneration(true);
    const count = await service.generateComplianceItems('case-1');
    // kid school x12, baby health x12, mom health+fds x24, head fds x12 => 60
    expect(count).toBe(60);

    const inserts = repoMock.query.mock.calls.filter((c: any[]) => String(c[0]).includes('INSERT INTO case_compliance_items'));
    expect(inserts).toHaveLength(60);
    expect(String(inserts[0][0])).toContain('ON CONFLICT');

    const typesByPerson: Record<string, Set<string>> = {};
    for (const [, params] of inserts) {
      const [, personId, complianceType, dueDate] = params;
      expect(dueDate).toMatch(/^\d{4}-\d{2}-01$/);
      typesByPerson[personId] = typesByPerson[personId] || new Set();
      typesByPerson[personId].add(complianceType);
    }
    expect(typesByPerson['p-kid']).toEqual(new Set(['school_attendance']));
    expect(typesByPerson['p-baby']).toEqual(new Set(['health_checkup']));
    expect(typesByPerson['p-mom']).toEqual(new Set(['health_checkup', 'fds']));
    expect(typesByPerson['p-head']).toEqual(new Set(['fds']));
  });

  it('returns 0 on rerun when every item already exists', async () => {
    mockGeneration(false);
    await expect(service.generateComplianceItems('case-1')).resolves.toBe(0);
  });

  it('throws when the household has no access card', async () => {
    repoMock.query
      .mockResolvedValueOnce([{ household_id: 'h1' }])
      .mockResolvedValueOnce([]);
    await expect(service.generateComplianceItems('case-1')).rejects.toThrow(NotFoundException);
  });

  it('throws when the case has no household', async () => {
    repoMock.query.mockResolvedValueOnce([]);
    await expect(service.generateComplianceItems('case-1')).rejects.toThrow(NotFoundException);
  });
});

describe('FourPsService compliance status', () => {
  let service: FourPsService;
  let repoMock: any;

  beforeEach(async () => {
    repoMock = { query: jest.fn(), find: jest.fn(), findOne: jest.fn(), save: jest.fn(), create: jest.fn((d: any) => d) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FourPsService,
        { provide: getRepositoryToken(CaseComplianceItem), useValue: repoMock },
        { provide: getRepositoryToken(CasePayout), useValue: { query: jest.fn(), find: jest.fn(), findOne: jest.fn(), save: jest.fn(), create: jest.fn((d: any) => d) } },
      ],
    }).compile();
    service = module.get(FourPsService);
  });

  it('computes totals, rate, and per-type breakdown', async () => {
    repoMock.find.mockResolvedValue([
      { id: 'c1', complianceType: 'school_attendance', met: true },
      { id: 'c2', complianceType: 'school_attendance', met: false },
      { id: 'c3', complianceType: 'fds', met: true },
    ]);
    const status = await service.getComplianceStatus('case-1');
    expect(status.total).toBe(3);
    expect(status.complied).toBe(2);
    expect(status.rate).toBeCloseTo(2 / 3);
    expect(status.byType['school_attendance']).toEqual({ total: 2, complied: 1, rate: 0.5 });
    expect(status.byType['fds']).toEqual({ total: 1, complied: 1, rate: 1 });
    expect(repoMock.find).toHaveBeenCalledWith({ where: { caseId: 'case-1' }, order: { dueDate: 'ASC' } });
  });

  it('marks an item met with the actor and timestamp', async () => {
    const entry = { id: 'c1', met: false, metAt: undefined, metBy: undefined };
    repoMock.findOne.mockResolvedValue(entry);
    repoMock.save.mockImplementation(async (e: any) => e);
    await service.markComplied('c1', 'user-1');
    expect(entry.met).toBe(true);
    expect(entry.metBy).toBe('user-1');
    expect(entry.metAt).toBeInstanceOf(Date);
    expect(repoMock.save).toHaveBeenCalledWith(entry);
  });

  it('unmarks an item', async () => {
    const entry = { id: 'c1', met: true, metAt: new Date(), metBy: 'user-1' };
    repoMock.findOne.mockResolvedValue(entry);
    repoMock.save.mockImplementation(async (e: any) => e);
    await service.unmarkComplied('c1');
    expect(entry.met).toBe(false);
    expect(entry.metAt).toBeUndefined();
    expect(entry.metBy).toBeUndefined();
  });

  it('throws for an unknown compliance id', async () => {
    repoMock.findOne.mockResolvedValue(null);
    await expect(service.markComplied('missing', 'user-1')).rejects.toThrow(NotFoundException);
    await expect(service.unmarkComplied('missing')).rejects.toThrow(NotFoundException);
  });
});
