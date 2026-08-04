import { useState, useEffect } from 'react';
import { getPendingCount } from '../lib/sync';

export function useSyncStatus() {
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let alive = true;
    const tick = () => {
      try {
        if (alive) setPending(getPendingCount());
      } catch {
        if (alive) setPending(0);
      }
    };
    tick();
    const interval = setInterval(tick, 5000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);
  return { pending };
}
