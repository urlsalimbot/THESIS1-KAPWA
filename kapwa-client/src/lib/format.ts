import i18n from '../i18n';

function activeLocale(): string {
  return i18n.language === 'fil' ? 'fil-PH' : 'en-PH';
}

// A bare "YYYY-MM-DD" is a calendar date, not an instant. Postgres `DATE`
// columns (`access_card_services.service_date`, and every other date-only field
// on the wire) arrive in exactly this shape, with no time and no zone.
// `new Date('2026-08-03')` parses it as UTC midnight, so a viewer anywhere west
// of UTC formats it as Aug 2 — a logged service silently shifts a day
// backwards. Read those as their own components and format them directly.
//
// Anything carrying a time is left alone: that value names a real instant, and
// the Asia/Manila pin in formatDateTime is what should place it.
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

function formatCalendarDate(value: string): string | null {
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  // Build in UTC and read back in UTC, so the host zone never enters into it.
  const utc = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(utc.getTime())) return null;
  // Rejects impossible calendar dates that Date.UTC would roll over silently
  // (e.g. 2026-02-30 becoming Mar 2).
  if (utc.getUTCMonth() !== m - 1 || utc.getUTCDate() !== d) return null;
  return utc.toLocaleDateString(activeLocale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  if (typeof d === 'string' && CALENDAR_DATE.test(d)) {
    return formatCalendarDate(d) ?? '—';
  }
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(activeLocale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Manila',
  });
}

/**
 * Today in Manila, as "YYYY-MM-DD" for an `<input type="date">` value.
 *
 * The office is UTC+8, so between 00:00 and 08:00 local the UTC date is
 * already yesterday. `toISOString().split('T')[0]` reads the UTC date, which
 * pre-filled yesterday's date on every service logged in the small hours. This
 * asks Manila what day it is, so the default is the day the coordinator is
 * standing in.
 */
export function todayInManila(now: Date = new Date()): string {
  // Read the parts rather than a formatted string: the ordering and separators
  // of a locale are not something to depend on for a wire value.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(p => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  // Fixed format: MMM DD, YYYY at h:mm AM/PM (e.g. "Sep 10, 2026 at 10:30 AM").
  // Two explicit calls (not toLocaleString) so the " at " separator is ours and
  // the output cannot drift with runtime ICU punctuation.
  const datePart = date.toLocaleDateString('en-US', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timePart = date.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${datePart} at ${timePart.replace(/\u202f/g, ' ')}`;
}

export function formatTimestamp(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  if (mins < 1) return i18n.t('time.justNow');
  if (mins < 60) return i18n.t('time.minutesAgo', { count: mins });
  if (hrs < 24) return i18n.t('time.hoursAgo', { count: hrs, minutes: mins % 60 });
  return i18n.t('time.daysAgo', { count: Math.floor(hrs / 24) });
}

/**
 * A resident's name for display: surname first, then given name.
 *
 * The API assembles these from the joined person with a `?? ''` fallback (see
 * `Referral`), so an empty surname is a value that really arrives, not a
 * missing field. Writing `${surname}, ${firstName}` at each site then renders
 * ", Juan" — a comma with nothing in front of it.
 *
 * **Residents only.** A coordinator's name is a single `fullName` field built
 * server-side as `first middle last` ("Juan Dela Cruz"), and that is deliberate:
 * staff are shown first-name-first, residents surname-first. Do not point this
 * helper at a coordinator.
 */
export function residentName(
  surname: string | null | undefined,
  firstName: string | null | undefined,
): string {
  const last = surname?.trim() ?? '';
  const first = firstName?.trim() ?? '';
  if (last && first) return `${last}, ${first}`;
  // One part is enough; a separator with nothing on one side of it is not.
  return last || first || '—';
}
