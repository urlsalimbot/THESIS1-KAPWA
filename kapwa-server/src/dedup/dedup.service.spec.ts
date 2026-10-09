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
    query: jest.fn().mockResolvedValue([]),
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

  it('creates an operation in the defined state', async () => {
    opsRepo.findOne.mockResolvedValue(null);
    await service.create({ source: 'Batch 1.xlsx', columnMap: map }, 'user-1');
    const saved = opsRepo.save.mock.calls[0][0];
    expect(saved.status).toBe('defined');
    expect(saved.source).toBe('Batch 1.xlsx');
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

  it('returns detail counts by row status for the review header', async () => {
    opsRepo.findOne.mockResolvedValue({ id: 'op1', source: 'x' });
    rowsRepo.query.mockResolvedValue([{ status: 'pending', count: '2' }, { status: 'no_match', count: '3' }]);
    const d = await service.detail('op1');
    expect(d.pending).toBe(2);
    expect(d.noMatch).toBe(3);
    expect(d.totalRows).toBe(5);
  });
});