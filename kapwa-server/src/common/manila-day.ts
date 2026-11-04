/**
 * The Manila calendar day (YYYY-MM-DD) for a date value, independent of the
 * server's timezone.
 *
 * `toISOString().slice(0, 10)` reads the UTC date, which is already yesterday
 * between 00:00 and 08:00 Manila — and Postgres `date` columns arrive as
 * JavaScript `Date`s at Manila midnight, so UTC slicing shifts every stored
 * date back a day. The client has the same rule in `todayInManila()`; this is
 * the server's copy.
 */
export function manilaDay(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
