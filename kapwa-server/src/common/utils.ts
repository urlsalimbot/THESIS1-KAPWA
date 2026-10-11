import { SATURDAY, SUNDAY } from './constants';

export function phTime(): string {
  const now = new Date();
  const phOffset = 8 * 60;
  const phLocal = new Date(now.getTime() + phOffset * 60 * 1000);
  return phLocal.toISOString().replace('Z', '+08:00');
}

/**
 * Money goes into `numeric(12,2)` columns. JavaScript floats do not: without
 * this, `1,234.567` from a form was stored as 1234.57 and three ₱1,234.56
 * amounts summed to ₱3,703.6799999999994 on screen. Rounding here means the
 * books show exactly what the database holds.
 */
export function roundMoney(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.round(n * 100) / 100;
}

/** Weekday count between two dates (SAT/SUN excluded) — one copy, two callers. */
export function workingDaysBetween(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day !== SUNDAY && day !== SATURDAY) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}
