import { PendingIntakesService } from './pending-intakes.service';

function repoMock() {
  return {
    create: jest.fn((d: any) => d),
    save: jest.fn(async (d: any) => d),
    find: jest.fn(),
    findOne: jest.fn(),
  };
}

describe('PendingIntakesService', () => {
  it('creates a pending row tied to the registration account', async () => {
    const repo = repoMock();
    const svc = new PendingIntakesService(repo as any);
    await svc.create('u1', { beneficiary: { surname: 'Reyes' } });
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ submittedByUserId: 'u1', status: 'pending' }));
    expect(repo.save).toHaveBeenCalled();
  });

  it('lists only pending rows, newest first', async () => {
    const repo = repoMock();
    repo.find.mockResolvedValue([{ id: 'pi1' }]);
    const svc = new PendingIntakesService(repo as any);
    await svc.listPending();
    expect(repo.find).toHaveBeenCalledWith({ where: { status: 'pending' }, order: { createdAt: 'DESC' } });
  });

  it('marks a row processed or dismissed with the reviewer', async () => {
    const repo = repoMock();
    repo.findOne.mockResolvedValue({ id: 'pi1', status: 'pending' });
    const svc = new PendingIntakesService(repo as any);
    const processed = await svc.markProcessed('pi1', 'u2');
    expect(processed.status).toBe('processed');
    expect(processed.reviewedBy).toBe('u2');
    const dismissed = await svc.dismiss('pi1', 'u3');
    expect(dismissed.status).toBe('dismissed');
  });
});
