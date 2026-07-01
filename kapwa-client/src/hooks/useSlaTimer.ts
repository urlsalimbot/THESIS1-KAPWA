import { useState, useEffect, useMemo } from 'react';
import { THRESHOLDS, type SlaStatus, formatElapsed } from '@/lib/sla-utils';

interface UseSlaTimerResult {
  elapsedDisplay: string;
  status: SlaStatus;
  fractionUsed: number;
}

export function useSlaTimer(
  stageStartedAt: string,
  slaHours: number,
  pollIntervalMs = 60000
): UseSlaTimerResult {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!stageStartedAt || slaHours <= 0) return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, pollIntervalMs);
    return () => clearInterval(interval);
  }, [stageStartedAt, slaHours, pollIntervalMs]);

  return useMemo(() => {
    if (!stageStartedAt || slaHours <= 0) {
      return { elapsedDisplay: '', status: 'compliant' as SlaStatus, fractionUsed: 0 };
    }
    const elapsedMs = now - new Date(stageStartedAt).getTime();
    const elapsedHours = elapsedMs / (1000 * 60 * 60);
    const fractionUsed = elapsedHours / slaHours;

    let status: SlaStatus;
    if (fractionUsed >= THRESHOLDS.breach) {
      status = 'breached';
    } else if (fractionUsed >= THRESHOLDS.warning) {
      status = 'warning';
    } else {
      status = 'compliant';
    }

    return {
      elapsedDisplay: formatElapsed(elapsedHours),
      status,
      fractionUsed: Math.min(fractionUsed, 1),
    };
  }, [now, stageStartedAt, slaHours]);
}
