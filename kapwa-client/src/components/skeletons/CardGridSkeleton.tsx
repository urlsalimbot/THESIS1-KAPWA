import { Skeleton } from '@/components/ui/skeleton';

interface CardGridSkeletonProps {
  count?: number;
}

export function CardGridSkeleton({ count = 4 }: CardGridSkeletonProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border border-border rounded-lg p-4 space-y-3">
          {/* Title skeleton */}
          <Skeleton className="h-4 w-[60%]" />
          {/* Body line 1 */}
          <Skeleton className="h-3 w-[90%]" />
          {/* Body line 2 */}
          <Skeleton className="h-3 w-[80%]" />
          {/* Action bar */}
          <Skeleton className="h-8 w-full mt-2" />
        </div>
      ))}
    </div>
  );
}
