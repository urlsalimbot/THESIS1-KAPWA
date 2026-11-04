import { manilaDay } from './manila-day.js';

describe('manilaDay', () => {
  it('reads the Manila day of a UTC instant (00:00-08:00 UTC is the next Manila day)', () => {
    // 2026-10-31 16:00 UTC is 2026-11-01 00:00 in Manila — the case that made
    // `toISOString().slice(0,10)` report the day before.
    expect(manilaDay(new Date('2026-10-31T16:00:00Z'))).toBe('2026-11-01');
  });

  it('keeps a date-only string on the same day', () => {
    expect(manilaDay('1990-07-07')).toBe('1990-07-07');
  });

  it('does not shift a Manila-midnight Date back a day', () => {
    // new Date(1990, 6, 7) is local midnight; in Asia/Manila the UTC readout is
    // 1990-07-06T16:00Z, which the old slice turned into 1990-07-06.
    expect(manilaDay(new Date(1990, 6, 7))).toBe('1990-07-07');
  });
});
