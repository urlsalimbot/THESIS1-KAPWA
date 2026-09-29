import { describe, it, expect } from 'vitest';
import { weekStart, expandRepeat, manilaDay, addDays, localIsoDay } from './team-utils';
import type { TeamEvent } from '../../lib/team-api';

describe('weekStart', () => {
  it('maps a mid-week day to the Monday 00:00 of the same week', () => {
    // Wed Sep 23 2026, 14:30 local
    const start = weekStart(new Date(2026, 8, 23, 14, 30));
    expect(start.getDay()).toBe(1);
    expect(start.getTime()).toBe(new Date(2026, 8, 21).getTime());
  });

  it('maps a Monday to itself at 00:00', () => {
    const start = weekStart(new Date(2026, 8, 28, 9, 15));
    expect(start.getDay()).toBe(1);
    expect(start.getTime()).toBe(new Date(2026, 8, 28).getTime());
  });

  it('treats Sunday as the end of the week — its Monday is the previous day', () => {
    // Sun Sep 20 2026 → Mon Sep 14 2026
    const start = weekStart(new Date(2026, 8, 20));
    expect(start.getDay()).toBe(1);
    expect(start.getTime()).toBe(new Date(2026, 8, 14).getTime());
  });

  it('does not mutate the input date', () => {
    const input = new Date(2026, 8, 23, 10);
    weekStart(input);
    expect(input.getTime()).toBe(new Date(2026, 8, 23, 10).getTime());
  });
});

describe('manilaDay', () => {
  it('pins a UTC instant to its Asia/Manila calendar day (UTC+8)', () => {
    // 18:00 UTC = 02:00 next day in Manila
    expect(manilaDay(new Date('2026-09-27T18:00:00.000Z'))).toBe('2026-09-28');
    // 15:59 UTC = 23:59 same day in Manila
    expect(manilaDay(new Date('2026-09-27T15:59:00.000Z'))).toBe('2026-09-27');
  });
});

describe('addDays / localIsoDay', () => {
  it('adds whole days and exposes local YYYY-MM-DD', () => {
    const base = new Date(2026, 8, 28);
    expect(localIsoDay(addDays(base, 6))).toBe('2026-10-04');
    expect(localIsoDay(addDays(base, -1))).toBe('2026-09-27');
  });
});

const baseEvent: TeamEvent = {
  id: 'e1',
  title: 'Team Meeting',
  startsAt: '2026-09-28T01:00:00.000Z',
  endsAt: '2026-09-28T02:00:00.000Z',
  visibleTo: 'staff',
};

// The 14-day window the brief pins: Mon Sep 28 – Sun Oct 11 2026.
const WINDOW_FROM = new Date('2026-09-28');
const WINDOW_TO = new Date('2026-10-11');

describe('expandRepeat', () => {
  it('treats an event without repeatRule as one-shot, inside the window only', () => {
    expect(expandRepeat(baseEvent, WINDOW_FROM, WINDOW_TO)).toHaveLength(1);
    const outside: TeamEvent = {
      ...baseEvent,
      startsAt: '2026-10-12T01:00:00.000Z',
      endsAt: '2026-10-12T02:00:00.000Z',
    };
    expect(expandRepeat(outside, WINDOW_FROM, WINDOW_TO)).toHaveLength(0);
  });

  it('expands a weekly series across a 14-day window', () => {
    const event: TeamEvent = { ...baseEvent, repeatRule: { freq: 'weekly', interval: 1 } };
    const out = expandRepeat(event, WINDOW_FROM, WINDOW_TO);
    expect(out).toHaveLength(2);
    expect(out[0].startsAt.toISOString()).toBe('2026-09-28T01:00:00.000Z');
    expect(out[1].startsAt.toISOString()).toBe('2026-10-05T01:00:00.000Z');
    // Duration is preserved per occurrence (endsAt shifted with startsAt).
    expect(out[1].endsAt.toISOString()).toBe('2026-10-05T02:00:00.000Z');
  });

  it('honors a weekly interval greater than 1', () => {
    const event: TeamEvent = { ...baseEvent, repeatRule: { freq: 'weekly', interval: 2 } };
    const out = expandRepeat(event, new Date('2026-09-28'), new Date('2026-10-25'));
    expect(out.map(o => o.startsAt.toISOString())).toEqual([
      '2026-09-28T01:00:00.000Z',
      '2026-10-12T01:00:00.000Z',
    ]);
  });

  it('includes only occurrences inside the window (an early start is skipped)', () => {
    const event: TeamEvent = {
      ...baseEvent,
      startsAt: '2026-09-21T01:00:00.000Z',
      endsAt: '2026-09-21T02:00:00.000Z',
      repeatRule: { freq: 'weekly', interval: 1 },
    };
    const out = expandRepeat(event, new Date('2026-09-28'), new Date('2026-09-28'));
    expect(out).toHaveLength(1);
    expect(out[0].startsAt.toISOString()).toBe('2026-09-28T01:00:00.000Z');
  });

  it('stops at a date-only until bound', () => {
    const event: TeamEvent = {
      ...baseEvent,
      repeatRule: { freq: 'weekly', interval: 1, until: '2026-10-04' },
    };
    const out = expandRepeat(event, WINDOW_FROM, WINDOW_TO);
    expect(out).toHaveLength(1);
    expect(out[0].startsAt.toISOString()).toBe('2026-09-28T01:00:00.000Z');
  });

  it('guards unknown freq values by treating the event as one-shot', () => {
    const event: TeamEvent = {
      ...baseEvent,
      repeatRule: { freq: 'monthly' } as Record<string, unknown>,
    };
    const out = expandRepeat(event, WINDOW_FROM, WINDOW_TO);
    expect(out).toHaveLength(1);
    expect(out[0].startsAt.toISOString()).toBe('2026-09-28T01:00:00.000Z');
  });

  it('accepts uppercase WEEKLY freq (RFC-5545 style)', () => {
    const event: TeamEvent = { ...baseEvent, repeatRule: { freq: 'WEEKLY', interval: 1 } };
    expect(expandRepeat(event, WINDOW_FROM, WINDOW_TO)).toHaveLength(2);
  });
});