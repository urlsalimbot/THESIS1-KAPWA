import { BadRequestException } from '@nestjs/common';
import { ReminderSettingsService } from './reminder-settings.service';

describe('ReminderSettingsService', () => {
  const settings = { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
  const svc = new ReminderSettingsService(settings as any);

  beforeEach(() => {
    jest.clearAllMocks();
    settings.create.mockImplementation((x) => x);
    settings.save.mockImplementation(async (x) => x);
  });

  it('validates offsets are strictly descending positive integers', () => {
    expect(() => svc.validateOffsets([60, 0])).toThrow(BadRequestException);
    expect(() => svc.validateOffsets([60, 120])).toThrow(BadRequestException);
    expect(() => svc.validateOffsets([60, 60])).toThrow(BadRequestException);
    expect(() => svc.validateOffsets([])).not.toThrow(); // explicit disable
    expect(() => svc.validateOffsets([4320, 1440, 180])).not.toThrow();
  });

  it('saves system defaults keyed by event type', async () => {
    settings.findOne.mockResolvedValue(null);
    await svc.saveSystemDefaults([
      { eventType: 'court_hearing', offsets: [1440] },
      { eventType: 'home_visit', offsets: [180] },
    ], 'u1');
    expect(settings.create).toHaveBeenCalledTimes(2);
    for (const call of (settings.create as jest.Mock).mock.calls) {
      expect(call[0]).toMatchObject({ scope: 'system', userId: null, updatedBy: 'u1' });
    }
  });

  it('updates an existing system row instead of inserting a duplicate', async () => {
    settings.findOne.mockResolvedValue({ id: 's1', scope: 'system', eventType: 'court_hearing', offsets: [4320] });
    await svc.saveSystemDefaults([{ eventType: 'court_hearing', offsets: [1440] }], 'u1');
    expect(settings.create).not.toHaveBeenCalled();
    expect(settings.save).toHaveBeenCalledWith(expect.objectContaining({ id: 's1', offsets: [1440], updatedBy: 'u1' }));
  });

  it('rejects an unknown event type', async () => {
    await expect(svc.saveSystemDefaults([{ eventType: 'birthday', offsets: [60] } as any], 'u1'))
      .rejects.toThrow(BadRequestException);
  });

  it('rejects a non-descending bulk payload before any write', async () => {
    settings.findOne.mockResolvedValue(null);
    await expect(svc.saveWorkerSettings('u1', [{ eventType: 'home_visit', offsets: [60, 120] }], 'u1'))
      .rejects.toThrow(BadRequestException);
    expect(settings.save).not.toHaveBeenCalled();
  });

  it('resolves a worker override over the system default', async () => {
    settings.findOne.mockImplementation(({ where }: any) =>
      Promise.resolve(where.scope === 'worker'
        ? { scope: 'worker', userId: 'u1', eventType: 'court_hearing', offsets: [60] }
        : { scope: 'system', eventType: 'court_hearing', offsets: [4320] }));
    await expect(svc.resolveOffsets('court_hearing', 'u1')).resolves.toEqual([60]);
  });

  it('falls back to the system default when the worker has no override', async () => {
    settings.findOne.mockImplementation(({ where }: any) =>
      Promise.resolve(where.scope === 'worker' ? null : { scope: 'system', eventType: 'home_visit', offsets: [1440] }));
    await expect(svc.resolveOffsets('home_visit', 'u1')).resolves.toEqual([1440]);
  });

  it('treats an explicit empty worker override as no reminders', async () => {
    settings.findOne.mockImplementation(({ where }: any) =>
      Promise.resolve(where.scope === 'worker'
        ? { scope: 'worker', userId: 'u1', eventType: 'home_visit', offsets: [] }
        : { scope: 'system', eventType: 'home_visit', offsets: [1440] }));
    await expect(svc.resolveOffsets('home_visit', 'u1')).resolves.toEqual([]);
  });

  it('returns no offsets when neither scope is configured', async () => {
    settings.findOne.mockResolvedValue(null);
    await expect(svc.resolveOffsets('court_hearing', 'u1')).resolves.toEqual([]);
  });
});