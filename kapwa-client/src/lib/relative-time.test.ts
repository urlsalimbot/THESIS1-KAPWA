import type { TFunction } from 'i18next';
import { relativeNotificationTime } from './relative-time';

/** A t() stand-in that interpolates the way the real one does. */
const t = ((key: string, fallback: string, opts?: { count?: number }) =>
  String(fallback).replace('{{count}}', String(opts?.count ?? ''))) as unknown as TFunction;

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

describe('relativeNotificationTime', () => {
  it('reads as "now" inside the first minute', () => {
    expect(relativeNotificationTime(ago(5_000), t)).toBe('now');
  });

  it('counts minutes, then hours', () => {
    expect(relativeNotificationTime(ago(5 * 60_000), t)).toBe('5m ago');
    expect(relativeNotificationTime(ago(3 * 3_600_000), t)).toBe('3h ago');
  });

  it('falls back to a date once it is a day old', () => {
    const old = ago(3 * 24 * 3_600_000);
    expect(relativeNotificationTime(old, t)).not.toMatch(/ago|now/);
    expect(relativeNotificationTime(old, t)).toBeTruthy();
  });
});
