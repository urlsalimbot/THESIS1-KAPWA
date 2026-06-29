import { useState, useEffect } from 'react';

export const STALE_AFTER_MS = 5 * 60 * 1000; // 5 minutes (matches SWR stale-while-revalidate)

const POLL_INTERVAL_MS = 30 * 1000; // 30 seconds

function formatElapsed(elapsed: number): string {
  const totalSeconds = Math.floor(elapsed / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);

  if (totalSeconds < 60) {
    return 'less than 1 min';
  }
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }
  if (totalHours < 24) {
    const remainingMinutes = totalMinutes % 60;
    return `${totalHours} hr ${remainingMinutes} min`;
  }
  const remainingHours = totalHours % 24;
  return `${totalDays} days ${remainingHours} hr`;
}

export function useCacheStaleness(cachedAt?: number): { isStale: boolean; ageDisplay: string } {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (cachedAt === undefined) return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [cachedAt]);

  if (cachedAt === undefined) {
    return { isStale: false, ageDisplay: '' };
  }

  const elapsed = now - cachedAt;

  if (elapsed < 0) {
    // Future timestamp — not stale
    return { isStale: false, ageDisplay: '' };
  }

  const isStale = elapsed >= STALE_AFTER_MS;
  const ageDisplay = isStale ? formatElapsed(elapsed) : '';

  return { isStale, ageDisplay };
}
