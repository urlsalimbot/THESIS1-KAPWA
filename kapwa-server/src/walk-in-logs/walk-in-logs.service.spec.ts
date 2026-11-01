import { WalkInLogsService } from './walk-in-logs.service';

function repoMock() {
  const qb: any = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getMany: jest.fn().mockResolvedValue([]),
  };
  return {
    create: jest.fn((d: any) => d),
    save: jest.fn(async (d: any) => ({ id: 'w1', ...d })),
    findOne: jest.fn(),
    query: jest.fn(),
    createQueryBuilder: jest.fn(() => qb),
    qb,
  };
}

describe('WalkInLogsService', () => {
  it('records a walk-in with a daily queue number and GAD age band', async () => {
    const repo = repoMock();
    repo.query.mockResolvedValue([{ next: 4 }]);
    const svc = new WalkInLogsService(repo as any);

    const out = await svc.create({
      firstName: 'Pedro', lastName: 'Reyes', dateOfBirth: '1988-03-21',
      sex: 'Male', purposeCode: 'aics_medical',
    }, 'u1');

    expect(out.queueNo).toBe(4);
    expect(out.status).toBe('waiting');
    expect(out.ageBand).toBe('18-59');
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ createdBy: 'u1', assignedTo: 'u1' }));
  });

  it('filters a visit day with a range instead of a ::date cast', async () => {
    const repo = repoMock();
    const svc = new WalkInLogsService(repo as any);
    await svc.list(1, 20, { date: '2026-11-01' });
    expect(repo.qb.andWhere).toHaveBeenCalledWith(
      'w.visitedAt >= :start AND w.visitedAt < :end',
      {
        start: new Date('2026-11-01T00:00:00+08:00'),
        end: new Date('2026-11-02T00:00:00+08:00'),
      },
    );
  });

  it('stamps service start and completion timestamps on status changes', async () => {
    const repo = repoMock();
    repo.findOne.mockResolvedValue({ id: 'w1', status: 'waiting', timeIn: new Date('2026-10-30T01:00:00Z') });
    const svc = new WalkInLogsService(repo as any);

    const started = await svc.update('w1', { status: 'in_service' });
    expect(started.serviceStartedAt).toBeTruthy();
    expect(started.completedAt).toBeNull();

    repo.findOne.mockResolvedValue({ id: 'w1', status: 'in_service', timeIn: new Date('2026-10-30T01:00:00Z'), serviceStartedAt: new Date('2026-10-30T01:05:00Z') });
    const closed = await svc.update('w1', { status: 'completed', outcome: 'Served' });
    expect(closed.completedAt).toBeTruthy();
  });

  it('aggregates daily, GAD, conversion and service-time counts', async () => {
    const repo = repoMock();
    const now = new Date('2026-10-30T02:00:00Z');
    repo.qb.getMany.mockResolvedValue([
      { id: 'a', queueNo: 1, status: 'completed', visitedAt: now, timeIn: now, serviceStartedAt: new Date('2026-10-30T02:10:00Z'), completedAt: new Date('2026-10-30T02:40:00Z'), purposeCode: 'aics_medical', barangay: 'Bigte', sex: 'Male', ageBand: '18-59', caseId: 'c1', isNewClient: true, referralId: null },
      { id: 'b', queueNo: 2, status: 'referred', visitedAt: now, timeIn: now, completedAt: new Date('2026-10-30T02:20:00Z'), purposeCode: 'scsr', barangay: 'Bigte', sex: 'Female', ageBand: '60+', caseId: null, isNewClient: false, referralId: null },
    ]);
    const svc = new WalkInLogsService(repo as any);

    const out = await svc.summary('2026-10-30', '2026-10-30');

    expect(out.visits).toBe(2);
    expect(out.purposes.aics_medical).toBe(1);
    expect(out.barangays.Bigte).toBe(2);
    expect(out.ageBands['60+']).toBe(1);
    expect(out.conversions.toCase).toBe(1);
    expect(out.daily).toEqual([{ date: '2026-10-30', count: 2 }]);
    expect(out.waitingMinutes).toBeGreaterThan(0);
  });
});
