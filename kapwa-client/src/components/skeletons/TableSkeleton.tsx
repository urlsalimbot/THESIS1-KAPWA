import { Skeleton } from '@/components/ui/skeleton';

const ROW_WIDTHS = ['w-[80%]', 'w-[60%]', 'w-[90%]', 'w-[70%]', 'w-[50%]'];

interface TableSkeletonProps {
  rows?: number;
}

export function TableSkeleton({ rows = 5 }: TableSkeletonProps) {
  return (
    <div className="space-y-3">
      {/* Header skeleton */}
      <Skeleton className="h-6 w-full mb-2" />
      {/* Body rows with variable widths */}
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={`h-4 ${ROW_WIDTHS[i % ROW_WIDTHS.length]}`} />
      ))}
      {/* Pagination bar skeleton */}
      <Skeleton className="h-4 w-[40%]" />
    </div>
  );
}
