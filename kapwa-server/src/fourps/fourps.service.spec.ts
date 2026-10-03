import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { FourPsService, ageFromDob } from './fourps.service';
import { CaseComplianceItem } from './fourps-compliance.entity';
import { CasePayout } from './fourps-payout.entity';
import { CaseIntervention } from '../case-interventions/case-intervention.entity';
import { AccessCardsService } from '../access-cards/access-cards.service';
import { LogServiceRowSchema } from '../access-cards/dto/access-cards.zod';

// 4Ps now auto-logs to the household access card and (on payout completion)
// records a case intervention. Both are best-effort collaborators.
const extraProviders = () => [
  { provide: getRepositoryToken(CaseIntervention), useValue: { save: jest.fn(), create: jest.fn((d: any) => d) } },
  { provide: AccessCardsService, useValue: { accessCardCodeFor: jest.fn().mockResolvedValue('NORZ-AC-2026-0001'), logService: jest.fn() } },
];

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
        ...extraProviders(),
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
        ...extraProviders(),
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

  it('allows a claimant who owns the case', async () => {
    repoMock.query.mockResolvedValueOnce([{ ok: 1 }]);
    repoMock.find.mockResolvedValue([]);
    await expect(service.getComplianceStatus('case-1', { id: 'u1', role: 'claimant' })).resolves.toMatchObject({ total: 0 });
    expect(repoMock.query).toHaveBeenCalledTimes(1);
  });

  it('rejects a claimant who does not own the case', async () => {
    repoMock.query.mockResolvedValueOnce([]);
    await expect(service.getComplianceStatus('case-1', { id: 'u1', role: 'claimant' })).rejects.toThrow(NotFoundException);
    expect(repoMock.find).not.toHaveBeenCalled();
  });

  it('skips the ownership check for non-claimants', async () => {
    repoMock.find.mockResolvedValue([]);
    await service.getComplianceStatus('case-1', { id: 'w1', role: 'coordinator' });
    expect(repoMock.query).not.toHaveBeenCalled();
  });

  it('marks an item met with the actor and timestamp', async () => {
    const entry = { id: 'c1', met: false, metAt: undefined, metBy: undefined };
    repoMock.findOne.mockResolvedValue(entry);
    repoMock.save.mockImplementation(async (e: any) => e);
    await service.markComplied('c1', { id: 'user-1' });
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
    expect(entry.metAt).toBeNull();
    expect(entry.metBy).toBeNull();
  });

  it('throws for an unknown compliance id', async () => {
    repoMock.findOne.mockResolvedValue(null);
    await expect(service.markComplied('missing', { id: 'user-1' })).rejects.toThrow(NotFoundException);
    await expect(service.unmarkComplied('missing')).rejects.toThrow(NotFoundException);
  });
});

describe('FourPsService payouts', () => {
  let service: FourPsService;
  let payoutRepoMock: any;

  beforeEach(async () => {
    payoutRepoMock = { query: jest.fn(), find: jest.fn(), findOne: jest.fn(), save: jest.fn(), create: jest.fn((d: any) => d) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FourPsService,
        { provide: getRepositoryToken(CaseComplianceItem), useValue: { query: jest.fn(), find: jest.fn(), findOne: jest.fn(), save: jest.fn(), create: jest.fn((d: any) => d) } },
        { provide: getRepositoryToken(CasePayout), useValue: payoutRepoMock },
        ...extraProviders(),
      ],
    }).compile();
    service = module.get(FourPsService);
  });

  it('schedules a payout as scheduled', async () => {
    payoutRepoMock.save.mockImplementation(async (e: any) => ({ id: 'p1', ...e }));
    const payout = await service.schedulePayout('case-1', { cycleNo: 'CY2026-02', scheduledAt: '2026-10-01', amount: 1200 }, { id: 'user-1' });
    expect(payoutRepoMock.create).toHaveBeenCalledWith({
      caseId: 'case-1', cycleNo: 'CY2026-02', scheduledAt: '2026-10-01', amount: 1200, status: 'scheduled',
    });
    expect(payout).toMatchObject({ id: 'p1', status: 'scheduled' });
  });

  it('updates a payout to a terminal status with remarks', async () => {
    const payout = { id: 'p1', status: 'scheduled' };
    payoutRepoMock.findOne.mockResolvedValue(payout);
    payoutRepoMock.save.mockImplementation(async (e: any) => e);
    await service.setPayoutStatus('p1', 'missed', 'Beneficiary did not attend', { id: 'user-1' });
    expect(payout.status).toBe('missed');
    expect((payout as any).remarks).toBe('Beneficiary did not attend');
  });

  it('records a notification', async () => {
    const payout = { id: 'p1', status: 'scheduled', notifiedAt: undefined, notifiedBy: undefined };
    payoutRepoMock.findOne.mockResolvedValue(payout);
    payoutRepoMock.save.mockImplementation(async (e: any) => e);
    await service.markNotified('p1', 'user-1');
    expect(payout.notifiedAt).toBeInstanceOf(Date);
    expect(payout.notifiedBy).toBe('user-1');
  });

  it('lists payouts for a case ordered by date', async () => {
    payoutRepoMock.find.mockResolvedValue([]);
    await service.listByCase('case-1');
    expect(payoutRepoMock.find).toHaveBeenCalledWith({ where: { caseId: 'case-1' }, order: { scheduledAt: 'ASC' } });
  });

  it('throws for unknown payout ids', async () => {
    payoutRepoMock.findOne.mockResolvedValue(null);
    await expect(service.setPayoutStatus('missing', 'completed', undefined, { id: 'user-1' })).rejects.toThrow(NotFoundException);
    await expect(service.markNotified('missing', 'user-1')).rejects.toThrow(NotFoundException);
  });
});

// 4Ps writes to the same `access_card_services` table the manual forms write to, so
// its rows must use the same category vocabulary (otherwise the card's category tabs
// never match them) and must carry the same audit columns (otherwise a coordinator
// never sees their own barangay's 4Ps rows and the row has no actor).
describe('FourPsService access-card logging', () => {
  let service: FourPsService;
  let repoMock: any;
  let payoutRepoMock: any;
  let interventionRepoMock: any;
  let cards: { accessCardCodeFor: jest.Mock; logService: jest.Mock };

  const actor = { id: 'user-1', assignedBarangay: 'Bigte' };

  function lastLog() {
    return cards.logService.mock.calls.at(-1)?.[0];
  }

  beforeEach(async () => {
    repoMock = { query: jest.fn(), find: jest.fn(), findOne: jest.fn(), save: jest.fn(), create: jest.fn((d: any) => d) };
    payoutRepoMock = {
      query: jest.fn().mockResolvedValue([{ beneficiary_id: 'ben-1' }]),
      find: jest.fn(), findOne: jest.fn(), save: jest.fn(), create: jest.fn((d: any) => d),
    };
    interventionRepoMock = { save: jest.fn(), create: jest.fn((d: any) => d) };
    cards = {
      accessCardCodeFor: jest.fn().mockResolvedValue('NORZ-AC-2026-0001'),
      logService: jest.fn().mockResolvedValue({ id: 'acs-1' }),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FourPsService,
        { provide: getRepositoryToken(CaseComplianceItem), useValue: repoMock },
        { provide: getRepositoryToken(CasePayout), useValue: payoutRepoMock },
        { provide: getRepositoryToken(CaseIntervention), useValue: interventionRepoMock },
        { provide: AccessCardsService, useValue: cards },
      ],
    }).compile();
    service = module.get(FourPsService);
  });

  it('logs a compliance check-off under the sanctioned "compliance" category', async () => {
    repoMock.findOne.mockResolvedValue({ id: 'c1', caseId: 'case-1', complianceType: 'health_checkup', monthLabel: 'Oct 2026' });
    repoMock.save.mockImplementation(async (e: any) => e);

    await service.markComplied('c1', actor);

    expect(lastLog()).toMatchObject({ category: 'compliance' });
    // The "4Ps" attribution stays in the description, so nothing is lost by folding
    // the category back onto the shared vocabulary.
    expect(lastLog().serviceRendered).toContain('4Ps compliance');
  });

  it('records who logged the check-off and which barangay they act for', async () => {
    repoMock.findOne.mockResolvedValue({ id: 'c1', caseId: 'case-1', complianceType: 'fds' });
    repoMock.save.mockImplementation(async (e: any) => e);

    await service.markComplied('c1', actor);

    expect(lastLog()).toMatchObject({ loggedBy: 'user-1', sourceBarangay: 'Bigte' });
  });

  it('leaves the barangay unset for a city-wide actor who has no assignment', async () => {
    repoMock.findOne.mockResolvedValue({ id: 'c1', caseId: 'case-1', complianceType: 'fds' });
    repoMock.save.mockImplementation(async (e: any) => e);

    await service.markComplied('c1', { id: 'mswdo-1' });

    expect(lastLog()).toMatchObject({ loggedBy: 'mswdo-1', sourceBarangay: undefined });
  });

  it('logs a scheduled payout under the sanctioned "payout" category with its actor', async () => {
    payoutRepoMock.save.mockImplementation(async (e: any) => ({ id: 'p1', ...e }));

    await service.schedulePayout('case-1', { cycleNo: 'CY2026-02', scheduledAt: '2026-10-01', amount: 1200 }, actor);

    expect(lastLog()).toMatchObject({ category: 'payout', loggedBy: 'user-1', sourceBarangay: 'Bigte', cost: 1200 });
  });

  it('logs a released payout under the sanctioned "payout" category with its actor', async () => {
    const payout = { id: 'p1', caseId: 'case-1', status: 'scheduled', scheduledAt: '2026-10-01', amount: 1200, cycleNo: 'CY2026-02' };
    payoutRepoMock.findOne.mockResolvedValue(payout);
    payoutRepoMock.save.mockImplementation(async (e: any) => e);

    await service.setPayoutStatus('p1', 'completed', undefined, actor);

    expect(lastLog()).toMatchObject({ category: 'payout', loggedBy: 'user-1', sourceBarangay: 'Bigte' });
    expect(lastLog().serviceRendered).toContain('4Ps payout released');
  });

  it('does not write to the card when the household has no beneficiary', async () => {
    payoutRepoMock.query.mockResolvedValue([]);
    payoutRepoMock.save.mockImplementation(async (e: any) => ({ id: 'p1', ...e }));

    await service.schedulePayout('case-1', { scheduledAt: '2026-10-01' }, actor);

    expect(cards.logService).not.toHaveBeenCalled();
  });

  it('still completes the compliance check-off when the card write fails', async () => {
    const entry = { id: 'c1', caseId: 'case-1', complianceType: 'fds', met: false };
    repoMock.findOne.mockResolvedValue(entry);
    repoMock.save.mockImplementation(async (e: any) => e);
    cards.accessCardCodeFor.mockRejectedValue(new Error('no card'));

    await expect(service.markComplied('c1', actor)).resolves.toBeUndefined();

    expect(entry.met).toBe(true);
  });

  // The 4Ps module reaches AccessCardsService.logService directly, so it never
  // passes through the controller's ZodPipe. Nothing else would notice if it
  // invented a private category value: the row would insert fine (the column is a
  // bare VARCHAR) and then match no category tab on the card. This walks every
  // write path and puts what it wrote through the schema the manual forms obey.
  it('writes only categories the manual logging form could have written', async () => {
    repoMock.findOne.mockResolvedValue({ id: 'c1', caseId: 'case-1', complianceType: 'fds' });
    repoMock.save.mockImplementation(async (e: any) => e);
    payoutRepoMock.save.mockImplementation(async (e: any) => ({ id: 'p1', ...e }));
    const payout = { id: 'p1', caseId: 'case-1', status: 'scheduled', scheduledAt: '2026-10-01', amount: 1200 };
    payoutRepoMock.findOne.mockResolvedValue(payout);

    await service.markComplied('c1', actor);
    await service.schedulePayout('case-1', { scheduledAt: '2026-10-01', amount: 1200 }, actor);
    await service.setPayoutStatus('p1', 'completed', undefined, actor);

    const written = cards.logService.mock.calls.map(([payload]) => payload);
    expect(written.length).toBeGreaterThanOrEqual(3);
    for (const payload of written) {
      // LogServiceRowSchema, not LogServiceSchema: it is the schema
      // AccessCardsService.logService actually runs, and it takes the Date this
      // module already holds (z.coerce.date) rather than an ISO string the
      // test would have to manufacture. Parsing the payload the same way the
      // callee does is what makes this a contract test instead of a proxy.
      const parsed = LogServiceRowSchema.safeParse({
        accessCardCode: payload.accessCardCode,
        serviceRendered: payload.serviceRendered,
        serviceDate: payload.serviceDate,
        cost: payload.cost,
        category: payload.category,
      });
      expect({ category: payload.category, ok: parsed.success }).toEqual({ category: payload.category, ok: true });
    }
  });
});

describe('FourPsService.getCaseContext', () => {
  let service: FourPsService;
  let repoMock: any;

  beforeEach(async () => {
    repoMock = { query: jest.fn(), find: jest.fn(), findOne: jest.fn(), save: jest.fn(), create: jest.fn((d: any) => d) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FourPsService,
        { provide: getRepositoryToken(CaseComplianceItem), useValue: repoMock },
        { provide: getRepositoryToken(CasePayout), useValue: { query: jest.fn(), find: jest.fn(), findOne: jest.fn(), save: jest.fn(), create: jest.fn((d: any) => d) } },
        ...extraProviders(),
      ],
    }).compile();
    service = module.get(FourPsService);
  });

  it('returns the control no., access card, and household members', async () => {
    repoMock.query
      .mockResolvedValueOnce([{ control_no: 'KAPWA-2026-00012', beneficiary_id: 'ben-1', household_id: 'hh-1' }])
      .mockResolvedValueOnce([{ access_card_code: 'NORZ-AC-2026-0001' }])
      .mockResolvedValueOnce([
        { id: 'hm-1', full_name: 'Juan Dela Cruz', relationship: 'Self', age: 46, occupation: 'Retired', income: 0, status: null, is_primary: true },
      ]);

    const ctx = await service.getCaseContext('case-1');

    expect(ctx).toMatchObject({
      controlNo: 'KAPWA-2026-00012',
      beneficiaryId: 'ben-1',
      accessCardCode: 'NORZ-AC-2026-0001',
    });
    expect(ctx.members).toEqual([
      { id: 'hm-1', fullName: 'Juan Dela Cruz', relationship: 'Self', age: 46, occupation: 'Retired', income: 0, status: null, isPrimary: true },
    ]);
  });

  it('throws when the case does not exist', async () => {
    repoMock.query.mockResolvedValueOnce([]);
    await expect(service.getCaseContext('missing')).rejects.toThrow(NotFoundException);
  });

  it('returns no card or members when the case has no household', async () => {
    repoMock.query.mockResolvedValueOnce([{ control_no: 'KAPWA-1', beneficiary_id: 'ben-1', household_id: null }]);
    const ctx = await service.getCaseContext('case-1');
    expect(ctx).toMatchObject({ controlNo: 'KAPWA-1', accessCardCode: null, members: [] });
  });
});
