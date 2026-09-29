import type { TeamEvent } from '../../lib/team-api';

// Team Workspace shared calendar math + vocabulary.
//
// Week math is deliberately host-TZ agnostic where it matters: `weekStart`
// speaks the host's local week (Monday 00:00 local, per the plan constraint),
// while `manilaDay` pins instants to the office's calendar day (Asia/Manila,
// UTC+8) so repeat expansion and grid placement never shift a day with the
// viewer's machine.

// --- Canonical vocabularies (mirror kapwa-server/src/team/*.service.ts) ---

export const BLOCK_TYPES = ['in_office', 'home_visit', 'field_day', 'on_leave', 'remote'] as const;

// The five block types plus the manual `offline` whereabouts state.
export const STATUS_VALUES = [
  'in_office',
  'home_visit',
  'field_day',
  'on_leave',
  'remote',
  'offline',
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];
export type TeamStatusValue = (typeof STATUS_VALUES)[number];

// Block bar colors — design: in-office blue/primary, home-visit green,
// field amber, leave gray, remote violet. Full literal classes so Tailwind
// generates them.
export const BLOCK_COLORS: Record<string, string> = {
  in_office: 'bg-sky-200/70 border-sky-600 text-sky-900',
  home_visit: 'bg-emerald-200/70 border-emerald-600 text-emerald-900',
  field_day: 'bg-amber-200/70 border-amber-600 text-amber-900',
  on_leave: 'bg-slate-300/70 border-slate-500 text-slate-800',
  remote: 'bg-violet-200/70 border-violet-600 text-violet-900',
};
export const BLOCK_COLOR_FALLBACK = 'bg-muted border-muted-foreground/40 text-muted-foreground';

// Whereabouts dot colors (chips across the views).
export const STATUS_COLORS: Record<string, string> = {
  in_office: 'bg-sky-500',
  home_visit: 'bg-emerald-500',
  field_day: 'bg-amber-500',
  on_leave: 'bg-slate-400',
  remote: 'bg-violet-500',
  offline: 'bg-gray-400',
};
export const STATUS_COLOR_FALLBACK = 'bg-muted-foreground';

// Display labels (inline strings — Task 15 moves these to i18n en+fil).
export const STATUS_LABELS: Record<string, string> = {
  in_office: 'In office',
  home_visit: 'Home visit',
  field_day: 'Field day',
  on_leave: 'On leave',
  remote: 'Remote',
  offline: 'Offline',
};

export const BLOCK_TYPE_LABELS: Record<string, string> = {
  in_office: 'In office',
  home_visit: 'Home visit',
  field_day: 'Field day',
  on_leave: 'On leave',
  remote: 'Remote',
};

// --- Week math ---

export const DAY_MS = 86_400_000;

/** Monday 00:00:00 of the week containing `date`, in local time. */
export function weekStart(date: Date): Date {
  const d = new Date(date);
  // getDay(): 0 = Sunday … 6 = Saturday. Monday is day 1; a Sunday belongs
  // to the week that started the previous Monday.
  const day = d.getDay();
  const daysSinceMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + daysSinceMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Local calendar day of `d` as YYYY-MM-DD (used for API bounds + headers). */
export function localIsoDay(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Calendar day of `d` in Asia/Manila as YYYY-MM-DD (repeat expansion). */
export function manilaDay(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(p => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// --- Repeat expansion ---

export interface RepeatInstance {
  event: TeamEvent;
  startsAt: Date;
  endsAt: Date;
}

const MAX_INSTANCES = 520;

/**
 * Expand a (possibly repeating) event into concrete occurrences within
 * [from, to]. Bounds are inclusive and compared as Asia/Manila calendar
 * days, matching the API's inclusive YYYY-MM-DD convention.
 *
 * `repeatRule` is a jsonb passthrough (`{ freq: 'weekly', interval?: number,
 * until?: 'YYYY-MM-DD' | ISO instant }`). Unknown/missing freq → the event
 * is treated as one-shot. A hard cap guards against pathological rules.
 */
export function expandRepeat(
  event: TeamEvent,
  from: Date | string,
  to: Date | string,
): RepeatInstance[] {
  const fromDay = manilaDay(toDate(from));
  const toDay = manilaDay(toDate(to));
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

  const rule = event.repeatRule;
  const freq =
    rule && typeof rule.freq === 'string' ? rule.freq.toLowerCase() : null;

  if (freq !== 'weekly') {
    // One-shot (no rule, or a freq we do not model): include iff its day is
    // inside the window.
    const day = manilaDay(start);
    return day >= fromDay && day <= toDay ? [{ event, startsAt: start, endsAt: end }] : [];
  }

  const interval =
    rule && typeof rule.interval === 'number' && rule.interval > 0
      ? Math.floor(rule.interval)
      : 1;
  const until = rule && typeof rule.until === 'string' ? rule.until : null;
  const untilIsDateOnly = Boolean(until && /^\d{4}-\d{2}-\d{2}$/.test(until));
  const untilInstant = until && !untilIsDateOnly ? new Date(until).getTime() : null;
  // PH observes no DST, so adding whole UTC days keeps the Manila wall time.
  const stepMs = interval * 7 * DAY_MS;
  const duration = Math.max(0, end.getTime() - start.getTime());

  const instances: RepeatInstance[] = [];
  for (let i = 0; i < MAX_INSTANCES; i += 1) {
    const s = new Date(start.getTime() + i * stepMs);
    const day = manilaDay(s);
    if (day > toDay) break;
    if (untilIsDateOnly && until && day > until) break;
    if (untilInstant !== null && !Number.isNaN(untilInstant) && s.getTime() > untilInstant) break;
    if (day >= fromDay) {
      instances.push({ event, startsAt: s, endsAt: new Date(s.getTime() + duration) });
    }
  }
  return instances;
}

/**
 * Normalize an expandRepeat bound: calendar strings ("YYYY-MM-DD") parse as
 * UTC midnight (matches lib/format's convention: Manila is always the same
 * calendar day); anything else parses as an instant.
 */
export function toDate(value: string | Date): Date {
  if (value instanceof Date) return new Date(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  }
  return new Date(value);
}