import { DedupService } from './dedup.service';
import { ColumnMap } from './dedup-parse.service';

const map: ColumnMap = {
  baseline: { lastName: 'Last Name', firstName: 'First Name', middleName: 'Middle Name', birthDate: 'Birthday', barangay: 'Barangay', remarks: 'Remarks' },
  extras: [],
};
const csv = 'Last Name,First Name,Middle Name,Birthday,Barangay,Remarks\nReyes,Pedro,Poblete,1988-03-21,Bigte,AICS\nRamos,Marites,,1990-07-07,Poblacion,Food pack\n';

function mockRepo(over: any = {}) {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn(async (e: any) => e),
    create: jest.fn((e: any) => e),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    find: jest.fn().mockResolvedValue([]),
    query: jest.fn().mockResolvedValue([]),
    manager: { query: jest.fn().mockResolvedValue([]) },
    ...over,
  };
}

const stubAdapter = {
  searchSimilar: jest.fn().mockResolvedValue([]),
  sim: (a: string, b: string) => (a === b ? 1 : 0),
};

describe('DedupService', () => {
  const opsRepo = mockRepo();
  const rowsRepo = mockRepo();
  const matchesRepo = mockRepo();
  const service = new DedupService(opsRepo as any, rowsRepo as any, matchesRepo as any, stubAdapter as any);

  beforeEach(() => { jest.clearAllMocks(); });

  it('creates an operation in the defined state with its intervention type', async () => {
    opsRepo.findOne.mockResolvedValue(null);
    await service.create({ source: 'Batch 1.xlsx', columnMap: map, interventionType: 'food_pack' }, 'user-1');
    const saved = opsRepo.save.mock.calls[0][0];
    expect(saved.status).toBe('defined');
    expect(saved.source).toBe('Batch 1.xlsx');
    expect(saved.interventionType).toBe('food_pack');
    expect(saved.createdBy).toBe('user-1');
    expect(saved.columnMap).toEqual({ ...map });
  });

  it('uploads a csv: parses rows, runs the sweep, and moves to reviewing', async () => {
    opsRepo.findOne.mockResolvedValue({ id: 'op1', status: 'defined', columnMap: map, matchThreshold: 0.75 });
    await service.upload('op1', Buffer.from(csv), 'list.csv', 'user-1');
    const savedRows = (rowsRepo.save.mock.calls as any[]).flatMap((c) => c[0]);
    expect(savedRows).toHaveLength(2);
    expect(savedRows[0]).toMatchObject({ operationId: 'op1', lastName: 'Reyes', firstName: 'Pedro', dob: '1988-03-21', status: 'no_match' });
    expect(savedRows[1].status).toBe('no_match');
    const updated = opsRepo.save.mock.calls.at(-1)[0];
    expect(updated.status).toBe('reviewing');
  });

  it('refuses an upload whose header misses a declared column', async () => {
    opsRepo.findOne.mockResolvedValue({ id: 'op1', status: 'defined', columnMap: map, matchThreshold: 0.75 });
    const bad = 'Last Name,First Name\nReyes,Pedro\n';
    await expect(service.upload('op1', Buffer.from(bad), 'list.csv', 'user-1')).rejects.toThrow(/Middle Name/);
    expect(rowsRepo.save).not.toHaveBeenCalled();
  });

  it('lists operations with pagination and status filter', async () => {
    opsRepo.findAndCount.mockResolvedValue([[{ id: 'op1' }], 1]);
    const out = await service.list(1, 10, 'reviewing');
    expect(out.total).toBe(1);
    const [options] = opsRepo.findAndCount.mock.calls[0] as any[];
    expect(options.where).toMatchObject({ status: 'reviewing' });
  });

  it('list carries per-operation review counts for the table', async () => {
    opsRepo.findAndCount.mockResolvedValue([[{ id: 'op1', source: 'Batch 1.xlsx' }], 1]);
    rowsRepo.query.mockResolvedValue([
      { operation_id: 'op1', status: 'pending', count: '2' },
      { operation_id: 'op1', status: 'no_match', count: '1' },
      { operation_id: 'op1', status: 'deprioritized', count: '4' },
    ]);
    const out = await service.list(1, 10);
    expect(out.data[0]).toMatchObject({ pending: 2, noMatch: 1, decided: 4, totalRows: 7 });
  });

  it('rowMatches enriches person candidates with recent remark history', async () => {
    rowsRepo.findOne.mockResolvedValue({ id: 'row1', operationId: 'op1', rowIndex: 2 });
    matchesRepo.findAndCount.mockResolvedValue([
      [{ id: 'm1', rowId: 'row1', targetType: 'db_person', targetPersonId: 'p1', score: 0.9, signals: {}, status: 'pending' }],
      1,
    ]);
    rowsRepo.query
      .mockResolvedValueOnce([{ id: 'p1', lastName: 'Reyes', firstName: 'Pedro' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          person_id: 'p1', kind: 'decision', remark: 'Same person.',
          source: 'Batch 1.xlsx', authorName: 'Juan Dela Cruz', createdAt: new Date('2026-10-01T02:30:00Z'),
        },
      ]);
    const out = await service.rowMatches('op1', 'row1', 1, 20);
    expect(out.data[0].person).toMatchObject({ id: 'p1' });
    expect(out.data[0].remarks).toEqual([
      {
        kind: 'decision', remark: 'Same person.',
        source: 'Batch 1.xlsx', authorName: 'Juan Dela Cruz', createdAt: expect.any(Date),
      },
    ]);
  });

  it('returns detail counts by row status for the review header', async () => {
    opsRepo.findOne.mockResolvedValue({ id: 'op1', source: 'x' });
    rowsRepo.query.mockResolvedValue([{ status: 'pending', count: '2' }, { status: 'no_match', count: '3' }]);
    const d = await service.detail('op1');
    expect(d.pending).toBe(2);
    expect(d.noMatch).toBe(3);
    expect(d.totalRows).toBe(5);
  });

  it('uploads deprioritize a matched client served within the 30-day window', async () => {
    opsRepo.findOne.mockResolvedValue({ id: 'op1', status: 'defined', columnMap: map, matchThreshold: 0.75, interventionType: 'food_pack' });
    const recent = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
    const adapter: any = {
      sim: (a: string, b: string) => (a === b ? 1 : 0),
      searchSimilar: jest.fn().mockResolvedValue([
        { id: 'p1', lastName: 'Reyes', firstName: 'Pedro', dob: '1988-03-21', barangay: 'Bigte' },
      ]),
    };
    rowsRepo.manager.query
      .mockResolvedValueOnce([]) // sweep: households by member (none)
      .mockResolvedValueOnce([]) // eligibility: households of matched person
      .mockResolvedValueOnce([
        { person_id: 'p1', deliveryDate: recent, type: 'food_pack' },
      ]);
    const service2 = new DedupService(opsRepo as any, rowsRepo as any, matchesRepo as any, adapter as any);
    await service2.upload('op1', Buffer.from(csv), 'list.csv', 'user-1');
    const savedRows = (rowsRepo.save.mock.calls as any[]).flatMap((c) => c[0]);
    expect(savedRows[0]).toMatchObject({ status: 'deprioritized', eligibility: 'disqualified' });
    expect(savedRows[0].remarks).toContain('within the last 30 days');
    // Allowed rows resolve at upload; a DISQUALIFIED row's matches require a
    // decision before finalize.
    const savedMatches = (matchesRepo.save.mock.calls as any[]).flatMap((c) => c[0]);
    expect(savedMatches[0].status).toBe('pending');
    expect(savedMatches[0].decidedBy).toBeUndefined();
  });

  it('rows supports the review filter for disqualified rows', async () => {
    rowsRepo.findAndCount.mockResolvedValue([[], 0]);
    await service.rows('op1', 1, 20, undefined, undefined, 'disqualified');
    const [options] = rowsRepo.findAndCount.mock.calls[0] as any[];
    expect(options.where).toMatchObject({ operationId: 'op1', eligibility: 'disqualified' });
    expect(options.where.eligibility_decision).toBeDefined();
  });

  it('upload deprioritizes the later row of an intra-list duplicate pair', async () => {
    opsRepo.findOne.mockResolvedValue({ id: 'op1', status: 'defined', columnMap: map, matchThreshold: 0.75, interventionType: 'food_pack' });
    const adapter: any = { sim: (a: string, b: string) => (a === b ? 1 : 0), searchSimilar: jest.fn().mockResolvedValue([]) };
    const dupCsv = 'Last Name,First Name,Middle Name,Birthday,Barangay,Remarks\nReyes,Pedro,Poblete,1988-03-21,Bigte,AICS\nReyes,Pedro,Poblete,1988-03-21,Bigte,AICS\n';
    const service2 = new DedupService(opsRepo as any, rowsRepo as any, matchesRepo as any, adapter as any);
    await service2.upload('op1', Buffer.from(dupCsv), 'dup.csv', 'user-1');
    const savedRows = (rowsRepo.save.mock.calls as any[]).flatMap((c) => c[0]);
    expect(savedRows.map((r: any) => r.status)).toEqual(['no_match', 'deprioritized']);
    expect(savedRows[1].eligibilityReason).toContain('Row 2');
  });

  it('agrees a waived row into service once all its matches are decided', async () => {
    opsRepo.findOne.mockResolvedValue({ id: 'op1', status: 'reviewing', interventionType: 'food_pack' });
    rowsRepo.findOne.mockResolvedValue({ id: 'r1', operationId: 'op1', eligibility: 'disqualified', status: 'deprioritized' });
    const pendingMatch = { id: 'ma1', rowId: 'r1', targetType: 'db_person', status: 'pending', score: 0.9 };
    const waivedMatch = { ...pendingMatch, status: 'primary' };
    matchesRepo.find
      .mockResolvedValueOnce([pendingMatch]) // decide them all
      .mockResolvedValueOnce([])             // nothing still pending
      .mockResolvedValueOnce([waivedMatch]); // derive the row
    await service.decideEligibility('op1', 'r1', 'waive', 'u1');
    const savedMatch = matchesRepo.save.mock.calls[0][0];
    expect(savedMatch).toMatchObject({ id: 'ma1', status: 'primary' });
    expect(rowsRepo.save.mock.calls[0][0]).toMatchObject({ eligibilityDecision: 'waive', status: 'retained' });
  });

  it('decides a single match by id and keeps the row blocked while others are pending', async () => {
    opsRepo.findOne.mockResolvedValue({ id: 'op1', status: 'reviewing' });
    rowsRepo.findOne.mockResolvedValue({ id: 'r1', operationId: 'op1', eligibility: 'disqualified', status: 'deprioritized' });
    matchesRepo.findOne.mockResolvedValue({ id: 'ma1', rowId: 'r1', targetType: 'db_person', status: 'pending' });
    matchesRepo.find
      .mockResolvedValueOnce([{ id: 'ma2', rowId: 'r1', status: 'pending' }]) // remaining after the single decision
      .mockResolvedValueOnce([]);
    await service.decideEligibility('op1', 'r1', 'confirm', 'u1', 'ma1');
    expect(matchesRepo.save.mock.calls[0][0]).toMatchObject({ id: 'ma1', status: 'deprioritized' });
    expect(rowsRepo.save).not.toHaveBeenCalled(); // row stays undecided
    expect(service).toBeDefined();
  });

  it('refuses an eligibility decision for a row that is not disqualified', async () => {
    opsRepo.findOne.mockResolvedValue({ id: 'op1', status: 'reviewing' });
    rowsRepo.findOne.mockResolvedValue({ id: 'r1', operationId: 'op1', eligibility: 'allowed', status: 'retained' });
    await expect(service.decideEligibility('op1', 'r1', 'waive', 'u1')).rejects.toThrow(/Only disqualified/);
  });
});
