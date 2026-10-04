import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CaseEventsService } from './case-events.service';

describe('CaseEventsService', () => {
  const eventRepo = { create: jest.fn(), save: jest.fn(), find: jest.fn(), findOne: jest.fn(), delete: jest.fn(), count: jest.fn() };
  const caseRepo = { findOne: jest.fn() };
  const sync = { upsertForEvent: jest.fn(), removeForEvent: jest.fn(), moveForCase: jest.fn() };
  const svc = new CaseEventsService(eventRepo as any, caseRepo as any, sync as any, undefined);

  const legalCase = { id: 'c1', controlNo: 'MSWD-2026-0012', caseCategory: 'Children in Conflict with the Law (CICL)', assignedWorkerId: 'w1' };

  beforeEach(() => { jest.clearAllMocks(); caseRepo.findOne.mockResolvedValue(legalCase); });

  it('rejects a court hearing on a non-legal category', async () => {
    caseRepo.findOne.mockResolvedValue({ ...legalCase, caseCategory: 'Solo Parent' });
    await expect(svc.create('c1', { eventType: 'court_hearing', eventDate: '2026-10-20' } as any, { id: 'u1' }))
      .rejects.toThrow(BadRequestException);
    expect(eventRepo.save).not.toHaveBeenCalled();
  });

  it('creates a home visit on any category and syncs it', async () => {
    eventRepo.create.mockImplementation((x) => x);
    eventRepo.save.mockImplementation((x) => Promise.resolve({ ...x, id: 'e1' }));
    const out = await svc.create('c1', { eventType: 'home_visit', eventDate: '2026-10-21' }, { id: 'u1' });
    expect(out.id).toBe('e1');
    expect(sync.upsertForEvent).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }), 'w1', 'MSWD-2026-0012');
  });

  it('does not sync a hearing the office is not attending', async () => {
    eventRepo.create.mockImplementation((x) => x);
    eventRepo.save.mockImplementation((x) => Promise.resolve({ ...x, id: 'e1' }));
    await svc.create('c1', { eventType: 'court_hearing', eventDate: '2026-10-20', attended: null }, { id: 'u1' });
    expect(sync.upsertForEvent).not.toHaveBeenCalled();
  });

  it('removes the block when an event is cancelled', async () => {
    eventRepo.findOne.mockResolvedValue({ id: 'e1', caseId: 'c1', eventType: 'home_visit', status: 'planned' });
    eventRepo.save.mockImplementation((x) => Promise.resolve(x));
    await svc.update('c1', 'e1', { status: 'cancelled' }, { id: 'u1' });
    expect(sync.removeForEvent).toHaveBeenCalledWith('e1');
    expect(sync.upsertForEvent).not.toHaveBeenCalled();
  });

  it('counts only non-cancelled events for the step predicate', async () => {
    eventRepo.count.mockResolvedValue(2);
    await expect(svc.countForCase('c1')).resolves.toBe(2);
    expect(eventRepo.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ caseId: 'c1' }) }));
  });

  it('404s on an event that belongs to another case', async () => {
    eventRepo.findOne.mockResolvedValue({ id: 'e1', caseId: 'OTHER' });
    await expect(svc.update('c1', 'e1', { status: 'done' }, { id: 'u1' })).rejects.toThrow(NotFoundException);
  });

  it('re-syncs an updated planned event', async () => {
    eventRepo.findOne.mockResolvedValue({ id: 'e1', caseId: 'c1', eventType: 'court_hearing', attended: true, status: 'planned' });
    eventRepo.save.mockImplementation((x) => Promise.resolve(x));
    await svc.update('c1', 'e1', { eventDate: '2026-10-22' }, { id: 'u1' });
    expect(sync.upsertForEvent).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }), 'w1', 'MSWD-2026-0012');
    expect(sync.removeForEvent).not.toHaveBeenCalled();
  });

  it('removes the block when an attended hearing is flipped to not attending', async () => {
    eventRepo.findOne.mockResolvedValue({ id: 'e1', caseId: 'c1', eventType: 'court_hearing', attended: true, status: 'planned' });
    eventRepo.save.mockImplementation((x) => Promise.resolve(x));
    await svc.update('c1', 'e1', { attended: false }, { id: 'u1' });
    expect(sync.removeForEvent).toHaveBeenCalledWith('e1');
    expect(sync.upsertForEvent).not.toHaveBeenCalled();
  });
});