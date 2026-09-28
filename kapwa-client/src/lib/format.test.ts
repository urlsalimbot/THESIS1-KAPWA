import { describe, it, expect, afterEach, vi } from 'vitest';
import i18n from '../i18n';
import { formatDate, formatDateTime, formatTimestamp, todayInManila } from './format';

const ORIGINAL_TZ = process.env.TZ;

afterEach(() => {
  i18n.changeLanguage('en');
  document.documentElement.lang = 'en';
  // Every test below may repoint the clock's zone; restore it so one test
  // cannot silently change the zone the rest of the suite runs under.
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

describe('format helpers', () => {
  it('formats dates in English locale by default', () => {
    expect(formatDate('2026-08-03')).toBe('Aug 3, 2026');
  });

  it('formats dates in Filipino month names when lang is fil', () => {
    i18n.changeLanguage('fil');
    expect(formatDate('2026-08-03')).toBe('Ago 3, 2026');
  });

  it('returns em dash for null/undefined', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
  });

  it('formats datetimes as "MMM DD, YYYY at h:mm AM/PM" in Asia/Manila', () => {
    expect(formatDateTime('2026-08-03T00:30:00Z')).toBe('Aug 3, 2026 at 8:30 AM');
    expect(formatDateTime('2026-09-28T06:30:00Z')).toBe('Sep 28, 2026 at 2:30 PM');
  });

  it('returns em dash for missing or invalid dates', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime('not-a-date')).toBe('—');
    expect(formatDate('not-a-date')).toBe('—');
  });

  it('localizes relative timestamps', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-03T12:00:00Z'));
    expect(formatTimestamp(new Date('2026-08-03T11:59:00Z').toISOString())).toMatch(/min/i);
    vi.useRealTimers();
  });
});

describe('formatDate with a calendar-date value', () => {
  // `access_card_services.service_date` is a Postgres DATE column, so the wire
  // value is a bare "YYYY-MM-DD" with no time and no zone. `new Date('2026-08-03')`
  // parses that as UTC midnight, and a viewer west of UTC then formats it as
  // Aug 2 — the service silently shifts a day backwards. The date is a calendar
  // fact, not an instant, so it must be read as its own components and never
  // routed through the host zone.
  it.each(['America/New_York', 'UTC', 'Asia/Manila', 'Pacific/Kiritimati'])(
    'shows the same day to a viewer in %s',
    (tz) => {
      process.env.TZ = tz;
      expect(formatDate('2026-08-03')).toBe('Aug 3, 2026');
      // A first-of-month and a 31st are where off-by-one actually lands.
      expect(formatDate('2026-07-01')).toBe('Jul 1, 2026');
      expect(formatDate('2026-08-31')).toBe('Aug 31, 2026');
    },
  );

  it('keeps a full timestamp on the instant it names', () => {
    // Not a calendar date — 23:30Z is genuinely the 4th in Manila, and
    // truncating to components would be a different bug.
    process.env.TZ = 'America/New_York';
    expect(formatDate('2026-08-03T23:30:00Z')).toBe('Aug 4, 2026');
  });
});

describe('todayInManila', () => {
  it('returns a YYYY-MM-DD string an <input type="date"> accepts', () => {
    expect(todayInManila(new Date('2026-09-28T12:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('names the Manila day, not the UTC one, during the Manila morning', () => {
    // 17:00Z on the 28th is already 01:00 on the 29th in Manila (UTC+8). The old
    // `toISOString().split('T')[0]` pre-filled "2026-09-28" here, so a coordinator
    // logging an early-morning service had yesterday's date handed to them.
    expect(todayInManila(new Date('2026-09-28T17:00:00Z'))).toBe('2026-09-29');
  });

  it('agrees with UTC in the Manila afternoon', () => {
    expect(todayInManila(new Date('2026-09-28T06:00:00Z'))).toBe('2026-09-28');
  });

  it('is the same day for a viewer anywhere on earth', () => {
    const instant = new Date('2026-09-28T17:30:00Z');
    process.env.TZ = 'America/New_York';
    expect(todayInManila(instant)).toBe('2026-09-29');
    process.env.TZ = 'Pacific/Kiritimati';
    expect(todayInManila(instant)).toBe('2026-09-29');
  });
});
