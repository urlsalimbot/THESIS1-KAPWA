import { Skeleton } from '@/components/ui/skeleton';

interface FormSkeletonProps {
  fields?: number;
}

export function FormSkeleton({ fields = 4 }: FormSkeletonProps) {
  return (
    <div className="space-y-6">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          {/* Label skeleton */}
          <Skeleton className="h-4 w-[120px]" />
          {/* Input skeleton */}
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      {/* Submit button skeleton */}
      <Skeleton className="h-10 w-[140px] mt-4" />
    </div>
  );
}
