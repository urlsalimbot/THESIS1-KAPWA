import { Clock } from 'lucide-react';
import { useSlaTimer } from '@/hooks/useSlaTimer';
import { getThresholdColor, getThresholdBgColor } from '@/lib/sla-utils';

interface SlaTimerProps {
  stageStartedAt: string;
  slaHours: number;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export function SlaTimer({ stageStartedAt, slaHours, size = 'md', showIcon = true }: SlaTimerProps) {
  const { elapsedDisplay, status } = useSlaTimer(stageStartedAt, slaHours);

  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 20 : 16;
  const textSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm';
  const dotSize = size === 'sm' ? 'h-1.5 w-1.5' : size === 'lg' ? 'h-2.5 w-2.5' : 'h-2 w-2';

  return (
    <span
      role="status"
      aria-label={`Elapsed: ${elapsedDisplay}, status: ${status}`}
      className={`inline-flex items-center gap-1.5 ${textSize} ${getThresholdColor(status)} ${getThresholdBgColor(status)} rounded-md px-2 py-0.5`}
    >
      {showIcon && <Clock size={iconSize} className="shrink-0" />}
      <span>{elapsedDisplay}</span>
      <span className={`${dotSize} rounded-full ${getThresholdColor(status).replace('text-', 'bg-')} shrink-0`} />
    </span>
  );
}
