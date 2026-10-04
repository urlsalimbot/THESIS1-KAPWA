import { CaseEventReminderService } from './case-event-reminder.service';

describe('CaseEventReminderService', () => {
  const events = { find: jest.fn() };
  const reminders = { findOne: jest.fn(), insert: jest.fn(), update: jest.fn() };
  const settings = { findOne: jest.fn() };
  const cases = { findOne: jest.fn() };
  const users = { findOne: jest.fn() };
  const notifs = { create: jest.fn(), checkConsent: jest.fn(), sendEmailDirect: jest.fn() };
  const svc = new CaseEventReminderService(events as any, reminders as any, settings as any, cases as any, users as any, notifs as any);

  // 2026-10-19 09:00. The event is 2026-10-20 09:00.
  // offset 4320 (3d) → remind_at 10-17 09:00 — due (catch-up)
  // offset 1440 (1d) → remind_at 10-19 09:00 — due (boundary, <= now)
  // offset  180 (3h) → remind_at 10-20 06:00 — not due
  const now = new Date('2026-10-19T09:00:00');
  const event = {
    id: 'e1', caseId: 'c1', eventType: 'court_hearing', attended: true,
    eventDate: '2026-10-20', startTime: '09:00', venue: 'RTC', title: 'Hearing', status: 'planned',
  };
  const caseRow = { id: 'c1', controlNo: 'MSWD-2026-0012', assignedWorkerId: 'w1' };

  beforeEach(() => {
    jest.clearAllMocks();
    events.find.mockResolvedValue([event]);
    cases.findOne.mockResolvedValue(caseRow);
    users.findOne.mockResolvedValue({ id: 'w1', email: 'worker@mswdo.gov', isActive: true });
    settings.findOne.mockResolvedValue({ scope: 'system', eventType: 'court_hearing', offsets: [4320, 1440, 180] });
    reminders.findOne.mockResolvedValue(null);
    reminders.insert.mockResolvedValue({});
    reminders.update.mockResolvedValue({});
    notifs.create.mockResolvedValue({ id: 'n1' });
    notifs.checkConsent.mockResolvedValue(true);
    notifs.sendEmailDirect.mockResolvedValue(true);
  });

  it('dispatches in-app + email for each due offset and claims both rows', async () => {
    const res = await svc.checkForReminders(now);
    // Two due offsets (3d catch-up + 1d boundary) × two channels.
    expect(res.dispatched).toBe(4);
    expect(reminders.insert).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'e1', offsetMinutes: 1440, channel: 'in_app' }));
    expect(reminders.insert).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'e1', offsetMinutes: 1440, channel: 'email' }));
    expect(reminders.insert).not.toHaveBeenCalledWith(expect.objectContaining({ offsetMinutes: 180 }));
    // One in-app row per due offset; the client links via the case id.
    expect(notifs.create).toHaveBeenCalledTimes(2);
    expect(notifs.create).toHaveBeenCalledWith(expect.objectContaining({ recipientId: 'w1', referenceId: 'c1' }));
  });

  it('does not claim already-sent offsets (dedupe)', async () => {
    reminders.findOne.mockImplementation(({ where }: any) =>
      Promise.resolve(where.offsetMinutes === 1440 ? { eventId: 'e1' } : null));
    await svc.checkForReminders(now);
    expect(reminders.insert).not.toHaveBeenCalledWith(expect.objectContaining({ offsetMinutes: 1440 }));
    // The other due offset still dispatches.
    expect(reminders.insert).toHaveBeenCalledWith(expect.objectContaining({ offsetMinutes: 4320 }));
  });

  it('uses the worker override instead of the system default', async () => {
    // Worker override: 2 days before → remind_at 10-18 09:00, due. The system
    // default's 1440/180 offsets must NOT be used.
    settings.findOne.mockImplementation(({ where }: any) =>
      Promise.resolve(where.scope === 'worker'
        ? { scope: 'worker', eventType: 'court_hearing', offsets: [2880] }
        : { scope: 'system', eventType: 'court_hearing', offsets: [4320, 1440, 180] }));
    const res = await svc.checkForReminders(now);
    expect(res.dispatched).toBe(2);
    expect(reminders.insert).toHaveBeenCalledWith(expect.objectContaining({ offsetMinutes: 2880, channel: 'in_app' }));
    expect(reminders.insert).not.toHaveBeenCalledWith(expect.objectContaining({ offsetMinutes: 1440 }));
  });

  it('treats an explicit empty worker override as no reminders', async () => {
    settings.findOne.mockImplementation(({ where }: any) =>
      Promise.resolve(where.scope === 'worker'
        ? { scope: 'worker', eventType: 'court_hearing', offsets: [] }
        : { scope: 'system', eventType: 'court_hearing', offsets: [4320, 1440, 180] }));
    const res = await svc.checkForReminders(now);
    expect(res.dispatched).toBe(0);
    expect(reminders.insert).not.toHaveBeenCalled();
  });

  it('skips hearings the office is not attending', async () => {
    events.find.mockResolvedValue([{ ...event, attended: null }]);
    const res = await svc.checkForReminders(now);
    expect(res.dispatched).toBe(0);
    expect(reminders.insert).not.toHaveBeenCalled();
  });

  it('never dispatches for done, cancelled, or past events', async () => {
    events.find.mockResolvedValue([
      { ...event, status: 'done' },
      { ...event, status: 'cancelled' },
      { ...event, id: 'e2', eventDate: '2026-10-18' },
    ]);
    const res = await svc.checkForReminders(now);
    expect(res.dispatched).toBe(0);
    expect(reminders.insert).not.toHaveBeenCalled();
  });

  it('skips the whole event when it has no assigned worker', async () => {
    cases.findOne.mockResolvedValue({ ...caseRow, assignedWorkerId: null });
    const res = await svc.checkForReminders(now);
    expect(res.dispatched).toBe(0);
  });

  it('emails only when consent says so; a missing address falls back to in-app', async () => {
    users.findOne.mockResolvedValue({ id: 'w1', email: null, isActive: true });
    const res = await svc.checkForReminders(now);
    // in-app for both due offsets, no email rows.
    expect(res.dispatched).toBe(2);
    expect(reminders.insert).not.toHaveBeenCalledWith(expect.objectContaining({ channel: 'email' }));
  });

  it('falls back to in-app when the email send throws', async () => {
    notifs.sendEmailDirect.mockRejectedValue(new Error('smtp down'));
    const res = await svc.checkForReminders(now);
    // The email claim row exists (claimed before delivery) but nothing throws.
    expect(res.dispatched).toBe(4);
    expect(notifs.create).toHaveBeenCalledTimes(2);
  });

  it('does nothing when no offsets are configured for the event type', async () => {
    settings.findOne.mockResolvedValue(null);
    const res = await svc.checkForReminders(now);
    expect(res.dispatched).toBe(0);
    expect(reminders.insert).not.toHaveBeenCalled();
  });

  it('sends no reminders for a home visit whose event date has passed', async () => {
    events.find.mockResolvedValue([
      { ...event, id: 'e3', eventType: 'home_visit', attended: null, eventDate: '2026-10-19', startTime: '08:00' },
    ]);
    const res = await svc.checkForReminders(now);
    expect(res.dispatched).toBe(0);
  });
});