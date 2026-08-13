import i18n from '../i18n';

function activeLocale(): string {
  return i18n.language === 'fil' ? 'fil-PH' : 'en-PH';
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(activeLocale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleString(activeLocale(), {
    timeZone: 'Asia/Manila',
  });
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
