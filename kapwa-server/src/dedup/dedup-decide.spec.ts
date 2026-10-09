import { DedupService } from './dedup.service';

function mockRepo(over: any = {}) {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn(async (e: any) => e),
    create: jest.fn((e: any) => e),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    query: jest.fn().mockResolvedValue([]),
    find: jest.fn().mockResolvedValue([]),
    ...over,
  };
}
const stubAdapter = { searchSimilar: jest.fn().mockResolvedValue([]), sim: () => 0 };

describe('DedupService decisions', () => {
  let opsRepo: any; let rowsRepo: any; let matchesRepo: any; let remarksService: any; let service: DedupService;

  beforeEach(() => {
    opsRepo = mockRepo(); rowsRepo = mockRepo(); matchesRepo = mockRepo(); remarksService = { append: jest.fn(async (e: any) => e) };
    service = new DedupService(opsRepo, rowsRepo, matchesRepo, stubAdapter as any, remarksService);
  });

  it('requires a remark when the import row is deprioritized', async () => {
    opsRepo.findOne.mockResolvedValue({ id: 'op1', status: 'reviewing' });
    matchesRepo.findOne.mockResolvedValue({ id: 'm1', rowId: 'r1', targetType: 'db_person', targetPersonId: 'p9', status: 'pending' });
    rowsRepo.findOne.mockResolvedValue({ id: 'r1', operationId: 'op1', status: 'pending' });
    await expect(service.decide('op1', 'm1', { keep: 'existing_record' }, 'u1')).rejects.toThrow(/remark/i);
    expect(matchesRepo.save).not.toHaveBeenCalled();
  });

  it('deprioritizes the row, stamps the decision, and records the remark on the beneficiary history', async () => {
    opsRepo.findOne.mockResolvedValue({ id: 'op1', status: 'reviewing', source: 'Batch 1.xlsx' });
    matchesRepo.findOne.mockResolvedValue({ id: 'm1', rowId: 'r1', targetType: 'db_person', targetPersonId: 'p9', status: 'pending' });
    rowsRepo.findOne.mockResolvedValue({ id: 'r1', operationId: 'op1', rowIndex: 2, status: 'pending', originalRemarks: 'AICS' });
    matchesRepo.find.mockResolvedValue([{ id: 'm1', rowId: 'r1', status: 'deprioritized', targetType: 'db_person' }]);
    rowsRepo.query.mockResolvedValue([{ id: 'ben-9' }]);

    const out = await service.decide('op1', 'm1', { keep: 'existing_record', remark: 'Same person as ben-9; duplicate listing.' }, 'u1');
    const savedMatch = matchesRepo.save.mock.calls[0][0];
    expect(savedMatch.status).toBe('deprioritized');
    expect(savedMatch.decidedBy).toBe('u1');
    expect(savedMatch.decidedAt).toBeInstanceOf(Date);
    expect(out.row.status).toBe('deprioritized');
    expect(out.row.remarks).toMatch(/duplicate/i);
    const savedRemark = remarksService.append.mock.calls[0][0];
    expect(savedRemark).toMatchObject({ beneficiaryId: 'ben-9', kind: 'decision', authoredBy: 'u1' });
  });

  it('marks the paired row primary when the other import row is kept', async () => {
    opsRepo.findOne.mockResolvedValue({ id: 'op1', status: 'reviewing' });
    matchesRepo.findOne.mockResolvedValue({ id: 'm2', rowId: 'r2', targetType: 'import_row', targetImportRowId: 'r1', status: 'pending' });
    rowsRepo.findOne.mockImplementation(async ({ where }: any) =>
      where.id === 'r2'
        ? { id: 'r2', operationId: 'op1', rowIndex: 3, status: 'pending' }
        : { id: 'r1', operationId: 'op1', rowIndex: 2, status: 'no_match' });
    matchesRepo.find.mockResolvedValue([{ id: 'm2', rowId: 'r2', status: 'deprioritized', targetType: 'import_row' }]);

    const out = await service.decide('op1', 'm2', { keep: 'other_import_row', remark: 'Row 2 is the canonical listing.' }, 'u1');
    expect(out.row.status).toBe('deprioritized');
    const primarySave = rowsRepo.save.mock.calls.find((c: any) => c[0].id === 'r1');
    expect(primarySave[0].status).toBe('primary');
  });

  it('reverts a decision back to pending', async () => {
    opsRepo.findOne.mockResolvedValue({ id: 'op1', status: 'reviewing' });
    matchesRepo.findOne.mockResolvedValue({ id: 'm1', rowId: 'r1', targetType: 'db_person', status: 'deprioritized', remark: 'x' });
    rowsRepo.findOne.mockResolvedValue({ id: 'r1', operationId: 'op1', status: 'deprioritized' });
    matchesRepo.find.mockResolvedValue([{ id: 'm1', rowId: 'r1', status: 'pending', targetType: 'db_person' }]);

    const out = await service.revert('op1', 'm1');
    expect(out.match.status).toBe('pending');
    expect(out.row!.status).toBe('pending');
  });

  it('refuses decisions when the operation is not in review', async () => {
    opsRepo.findOne.mockResolvedValue({ id: 'op1', status: 'finalized' });
    await expect(service.decide('op1', 'm1', { keep: 'import_row' }, 'u1')).rejects.toThrow(/not in review|finalized/i);
  });
});