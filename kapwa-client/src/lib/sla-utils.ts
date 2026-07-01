export type SlaStatus = 'compliant' | 'warning' | 'breached';

export const THRESHOLDS = {
  warning: 0.7,
  breach: 0.9,
} as const;

export function getThresholdColor(status: SlaStatus): string {
  switch (status) {
    case 'compliant': return 'text-green-500';
    case 'warning': return 'text-amber-500';
    case 'breached': return 'text-red-500';
  }
}

export function getThresholdBgColor(status: SlaStatus): string {
  switch (status) {
    case 'compliant': return 'bg-green-500/10';
    case 'warning': return 'bg-amber-500/10';
    case 'breached': return 'bg-red-500/10';
  }
}

export function formatElapsed(elapsedHours: number): string {
  if (elapsedHours < 0) return '0h';
  if (elapsedHours < 24) return `${Math.floor(elapsedHours)}h`;
  const days = Math.floor(elapsedHours / 24);
  const hours = Math.floor(elapsedHours % 24);
  return `${days}d ${hours}h`;
}
