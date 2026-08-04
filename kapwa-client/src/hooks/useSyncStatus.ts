import { useState, useEffect } from 'react';
import { loadQueue } from '../lib/offline-queue';
import { useConnectivity } from './useConnectivity';

export function useSyncStatus() {
  const [pending, setPending] = useState(0);
  const isOnline = useConnectivity();

  useEffect(() => {
    let alive = true;
    const tick = () => {
      try {
        const q = loadQueue();
        if (alive) setPending(q.filter(c => c.status === 'pending').length);
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
  return { pending, isOnline };
}
