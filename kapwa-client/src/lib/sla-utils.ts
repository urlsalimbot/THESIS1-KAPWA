export type SlaStatus = 'compliant' | 'warning' | 'breached';

export const THRESHOLDS = {
  warning: 0.7,
  breach: 0.9,
} as const;

export function getThresholdColor(status: SlaStatus): string {
  switch (status) {
    case 'compliant': return 'text-success';
    case 'warning': return 'text-warning';
    case 'breached': return 'text-destructive';
  }
}

export function getThresholdBgColor(status: SlaStatus): string {
  switch (status) {
    case 'compliant': return 'bg-success';
    case 'warning': return 'bg-warning';
    case 'breached': return 'bg-destructive/100/10';
  }
}

export function formatElapsed(elapsedHours: number): string {
  if (elapsedHours < 0) return '0h';
  if (elapsedHours < 24) return `${Math.floor(elapsedHours)}h`;
  const days = Math.floor(elapsedHours / 24);
  const hours = Math.floor(elapsedHours % 24);
  return `${days}d ${hours}h`;
}
