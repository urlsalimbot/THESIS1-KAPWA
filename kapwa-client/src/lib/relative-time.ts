import type { TFunction } from 'i18next';
import { formatDate } from './format';

/**
 * Notification timestamps, short enough for a dense list: "now", "5m ago",
 * "3h ago", then a date. Shared by the notifications page and the topbar menu so
 * the same notification never reads differently in the two places.
 */
export function relativeNotificationTime(dateStr: string, t: TFunction): string {
  const minutes = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60_000);
  if (minutes < 1) return t('notifications.justNow', 'now');
  if (minutes < 60) return t('notifications.minutesAgo', '{{count}}m ago', { count: minutes });

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('notifications.hoursAgo', '{{count}}h ago', { count: hours });

  return formatDate(dateStr);
}
