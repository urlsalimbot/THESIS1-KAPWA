import { cn } from '@/lib/utils';
import { caseStatusClass } from '@/lib/status-style';

/** One status chip for case lifecycle statuses — token class, both themes. */
export function StatusBadge({
  status,
  label,
  className,
}: {
  status?: string | null;
  label?: string;
  className?: string;
}) {
  return (
    <span className={cn('badge', caseStatusClass(status), className)}>
      {label ?? status ?? ''}
    </span>
  );
}