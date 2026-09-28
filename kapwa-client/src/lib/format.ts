import i18n from '../i18n';

function activeLocale(): string {
  return i18n.language === 'fil' ? 'fil-PH' : 'en-PH';
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(activeLocale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
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
