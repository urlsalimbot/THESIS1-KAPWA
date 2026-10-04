import { TeamScheduleSyncService } from './team-schedule-sync.service';

describe('TeamScheduleSyncService', () => {
  const blockRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn(), delete: jest.fn(), merge: jest.fn() };
  const caseRepo = { findOne: jest.fn() };
  const eventRepo = { find: jest.fn() };
  const svc = new TeamScheduleSyncService(blockRepo as any, caseRepo as any, eventRepo as any);

  const event = {
    id: 'evt-1', eventType: 'court_hearing', eventDate: '2026-10-20',
    startTime: '09:00', endTime: '10:00', title: 'Hearing', venue: 'RTC Bulacan',
    status: 'planned',
  };

  beforeEach(() => jest.clearAllMocks());

  it('creates a synced block for the assigned worker', async () => {
    blockRepo.findOne.mockResolvedValue(null);
    blockRepo.create.mockImplementation((x) => x);
    blockRepo.save.mockResolvedValue({ id: 'block-1' });
    await svc.upsertForEvent(event as any, 'worker-1', 'MSWD-2026-0012');
    expect(blockRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'worker-1', blockDate: '2026-10-20', blockType: 'court_hearing',
      source: 'case_event', sourceRef: 'evt-1',
    }));
    const note = (blockRepo.create as jest.Mock).mock.calls[0][0].note as string;
    expect(note).toContain('MSWD-2026-0012');
  });

  it('updates the existing block instead of duplicating', async () => {
    blockRepo.findOne.mockResolvedValue({ id: 'block-1', userId: 'worker-1' });
    blockRepo.merge.mockImplementation((a, b) => ({ ...a, ...b }));
    blockRepo.save.mockResolvedValue({ id: 'block-1' });
    await svc.upsertForEvent({ ...event, eventDate: '2026-10-21' } as any, 'worker-1', 'MSWD-2026-0012');
    expect(blockRepo.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ sourceRef: 'evt-1' }) }));
    expect(blockRepo.save).toHaveBeenCalledTimes(1);
  });

  it('no-ops when the case has no assigned worker', async () => {
    await svc.upsertForEvent(event as any, null, 'MSWD-2026-0012');
    expect(blockRepo.save).not.toHaveBeenCalled();
    expect(blockRepo.create).not.toHaveBeenCalled();
  });

  it('removes the block for a cancelled event', async () => {
    await svc.removeForEvent('evt-1');
    expect(blockRepo.delete).toHaveBeenCalledWith(expect.objectContaining({ source: 'case_event', sourceRef: 'evt-1' }));
  });

  it('moves all synced blocks to the new worker on reassignment', async () => {
    eventRepo.find.mockResolvedValue([event]);
    blockRepo.findOne.mockResolvedValue(null);
    blockRepo.create.mockImplementation((x) => x);
    blockRepo.save.mockResolvedValue({});
    await svc.moveForCase('case-9', 'worker-2');
    expect(eventRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ caseId: 'case-9' }) }));
    expect(blockRepo.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'worker-2' }));
    expect(blockRepo.delete).toHaveBeenCalledWith(expect.objectContaining({ source: 'case_event', sourceRef: 'evt-1' }));
  });
});