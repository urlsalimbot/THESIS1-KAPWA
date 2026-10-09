import { DedupService } from './dedup.service';

function mockRepo(over: any = {}) {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn(async (e: any) => e),
    create: jest.fn((e: any) => e),
    find: jest.fn().mockResolvedValue([]),
    query: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    manager: { transaction: async (fn: any) => fn() },
    ...over,
  };
}
const stubAdapter = { searchSimilar: jest.fn().mockResolvedValue([]), sim: () => 0 };
const stubWriter = { write: jest.fn().mockResolvedValue('exports/client-dedup/op1.xlsx') };

describe('DedupService.finalize', () => {
  let opsRepo: any; let rowsRepo: any; let matchesRepo: any; let remarksRepo: any;
  let personRepo: any; let beneficiaryRepo: any; let addressRepo: any; let service: DedupService;

  beforeEach(() => {
    opsRepo = mockRepo(); rowsRepo = mockRepo(); matchesRepo = mockRepo(); remarksRepo = mockRepo();
    personRepo = mockRepo(); beneficiaryRepo = mockRepo(); addressRepo = mockRepo();
    service = new DedupService(opsRepo, rowsRepo, matchesRepo, stubAdapter as any, remarksRepo, personRepo, beneficiaryRepo, addressRepo, stubWriter as any);
  });

  it('refuses to finalize while any match is still pending, writing nothing', async () => {
    opsRepo.findOne.mockResolvedValue({ id: 'op1', status: 'reviewing' });
    rowsRepo.query.mockResolvedValue([{ id: 'r5' }]);
    await expect(service.finalize('op1', 'u1')).rejects.toThrow(/pending/i);
    expect(opsRepo.save).not.toHaveBeenCalled();
    expect(personRepo.create).not.toHaveBeenCalled();
  });

  it('creates a person + beneficiary for a no_match row without a gender, and records the import remark', async () => {
    opsRepo.findOne.mockResolvedValue({ id: 'op1', status: 'reviewing', source: 'Batch 1.xlsx' });
    rowsRepo.query.mockResolvedValue([]);
    rowsRepo.find.mockResolvedValue([{ id: 'r1', rowIndex: 2, status: 'no_match', lastName: 'Reyes', firstName: 'Pedro', dob: '1988-03-21', barangay: 'Bigte', originalRemarks: 'AICS' }]);
    personRepo.save.mockResolvedValue({ id: 'p-new' });
    beneficiaryRepo.save.mockResolvedValue({ id: 'ben-new' });

    const result = await service.finalize('op1', 'u1');

    expect(result.created).toBe(1);
    const createdPerson = personRepo.create.mock.calls[0][0];
    expect(createdPerson).toMatchObject({ surname: 'Reyes', firstName: 'Pedro' });
    expect(createdPerson.gender).toBeUndefined();
    expect(beneficiaryRepo.create.mock.calls[0][0]).toMatchObject({ personId: 'p-new' });
    const remark = remarksRepo.save.mock.calls[0][0];
    expect(remark).toMatchObject({ beneficiaryId: 'ben-new', kind: 'import', remark: 'AICS', authoredBy: 'u1' });
    const savedOp = opsRepo.save.mock.calls.at(-1)[0];
    expect(savedOp).toMatchObject({ status: 'finalized', accomplisher: 'u1', outputFile: 'exports/client-dedup/op1.xlsx' });
  });

  it('updates the retained record and records a barangay_update remark when the barangay differs', async () => {
    opsRepo.findOne.mockResolvedValue({ id: 'op1', status: 'reviewing', source: 'Batch 1.xlsx' });
    rowsRepo.query
      .mockResolvedValueOnce([]) // pending guard
      .mockResolvedValueOnce([{ id: 'ben-9' }]); // beneficiary lookup
    rowsRepo.find.mockResolvedValue([{ id: 'r1', rowIndex: 2, status: 'retained', matchedPersonId: 'p9', lastName: 'Reyes', firstName: 'Pedro', dob: '1988-03-21', barangay: 'Partida' }]);
    personRepo.findOne.mockResolvedValue({ id: 'p9', surname: 'Reyes', firstName: 'Pedro', addresses: [{ addressType: 'current', barangay: 'Bigte' }] });

    const result = await service.finalize('op1', 'u1');

    expect(result.updated).toBe(1);
    expect(result.barangayUpdates).toBe(1);
    expect((rowsRepo.save.mock.calls.find((c: any) => c[0].id === 'r1') as any)[0].remarks).toMatch(/Barangay updated to Partida/);
    const savedAddress = addressRepo.save.mock.calls[0][0];
    expect(savedAddress.barangay).toBe('Partida');
    expect(remarksRepo.save.mock.calls[0][0]).toMatchObject({ beneficiaryId: 'ben-9', kind: 'barangay_update' });
  });

  it('creates nothing for a deprioritized row', async () => {
    opsRepo.findOne.mockResolvedValue({ id: 'op1', status: 'reviewing', source: 'x' });
    rowsRepo.query.mockResolvedValue([]);
    rowsRepo.find.mockResolvedValue([{ id: 'r1', status: 'deprioritized', remarks: 'Deprioritized — duplicate' }]);

    const result = await service.finalize('op1', 'u1');

    expect(result.deprioritized).toBe(1);
    expect(personRepo.create).not.toHaveBeenCalled();
    expect(beneficiaryRepo.create).not.toHaveBeenCalled();
  });

  it('refuses a second finalize and leaves the operation unfinalized when a save fails', async () => {
    opsRepo.findOne.mockResolvedValue({ id: 'op1', status: 'finalized' });
    await expect(service.finalize('op1', 'u1')).rejects.toThrow(/not in review|finalized/i);

    opsRepo.findOne.mockResolvedValue({ id: 'op1', status: 'reviewing', source: 'x' });
    rowsRepo.query.mockResolvedValue([]);
    rowsRepo.find.mockResolvedValue([{ id: 'r1', status: 'no_match', lastName: 'A', firstName: 'B', dob: '1990-01-01' }]);
    personRepo.save.mockRejectedValueOnce(new Error('db down'));
    opsRepo.save.mockClear();

    await expect(service.finalize('op1', 'u1')).rejects.toThrow(/db down/);
    expect(opsRepo.save).not.toHaveBeenCalled();
  });
});