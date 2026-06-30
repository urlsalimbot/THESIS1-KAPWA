import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SlaTimer } from './SlaTimer';
import { formatElapsed } from '@/lib/sla-utils';

interface SlaTooltipProps {
  stageStartedAt: string;
  slaHours: number;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export function SlaTooltip({ stageStartedAt, slaHours, size, showIcon }: SlaTooltipProps) {
  const startDate = new Date(stageStartedAt);
  const elapsedMs = Date.now() - startDate.getTime();
  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  const remainingHours = Math.max(0, slaHours - elapsedHours);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help">
          <SlaTimer stageStartedAt={stageStartedAt} slaHours={slaHours} size={size} showIcon={showIcon} />
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs space-y-1">
        <p>Started: {startDate.toLocaleString()}</p>
        <p>SLA: {slaHours}h total</p>
        <p>Elapsed: {formatElapsed(elapsedHours)}</p>
        <p>Remaining: {formatElapsed(remainingHours)}</p>
      </TooltipContent>
    </Tooltip>
  );
}
