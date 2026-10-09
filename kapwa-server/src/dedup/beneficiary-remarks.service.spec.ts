import { BadRequestException } from '@nestjs/common';
import { BeneficiaryRemarksService } from './beneficiary-remarks.service';

function mockRepo(over: any = {}) {
  return {
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    create: jest.fn((e: any) => e),
    save: jest.fn(async (e: any) => e),
    query: jest.fn().mockResolvedValue([]),
    ...over,
  };
}

describe('BeneficiaryRemarksService', () => {
  let repo: any;
  let service: BeneficiaryRemarksService;

  beforeEach(() => {
    repo = mockRepo();
    service = new BeneficiaryRemarksService(repo);
  });

  it('lists a beneficiary’s remarks newest-first, paginated', async () => {
    repo.findAndCount.mockResolvedValue([[{ id: 'r1' }, { id: 'r2' }], 7]);
    const out = await service.list('ben-1', 2, 2);
    expect(out).toMatchObject({ total: 7, page: 2, limit: 2 });
    const [options] = repo.findAndCount.mock.calls[0] as any[];
    expect(options.where).toEqual({ beneficiaryId: 'ben-1' });
    expect(options.order).toEqual({ createdAt: 'DESC' });
    expect(options.skip).toBe(2);
    expect(options.take).toBe(2);
  });

  it('decorates each remark with its author’s display name', async () => {
    repo.findAndCount.mockResolvedValue([
      [{ id: 'r1', authoredBy: 'u1' }, { id: 'r2', authoredBy: null }],
      2,
    ]);
    repo.query.mockResolvedValue([{ id: 'u1', fullName: 'Juan Dela Cruz' }]);
    const out = await service.list('ben-1', 1, 20);
    expect(out.data[0]).toMatchObject({ id: 'r1', authorName: 'Juan Dela Cruz' });
    expect(out.data[1]).toMatchObject({ id: 'r2', authorName: null });
  });

  it('rejects an empty manual remark', async () => {
    await expect(service.add('ben-1', { remark: '   ' }, 'u1')).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('records a manual remark with its author', async () => {
    await service.add('ben-1', { remark: '  Client called to reschedule.  ' }, 'u1');
    expect(repo.create.mock.calls[0][0]).toEqual({
      beneficiaryId: 'ben-1',
      kind: 'manual',
      remark: 'Client called to reschedule.',
      authoredBy: 'u1',
    });
    expect(repo.save).toHaveBeenCalled();
  });

  it('append stamps kind, source and author for operation-driven remarks', async () => {
    await service.append({
      beneficiaryId: 'ben-9',
      operationId: 'op1',
      kind: 'decision',
      remark: 'Same person as ben-9.',
      source: 'Batch 1.xlsx',
      authoredBy: 'u2',
    });
    expect(repo.create.mock.calls[0][0]).toEqual({
      beneficiaryId: 'ben-9',
      operationId: 'op1',
      kind: 'decision',
      remark: 'Same person as ben-9.',
      source: 'Batch 1.xlsx',
      authoredBy: 'u2',
    });
  });
});