import { describe, it, expect, afterEach, vi } from 'vitest';
import i18n from '../i18n';
import { formatDate, formatDateTime, formatTimestamp } from './format';

afterEach(() => {
  i18n.changeLanguage('en');
  document.documentElement.lang = 'en';
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
