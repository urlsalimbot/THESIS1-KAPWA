import type { ReactNode } from 'react';
import { ErrorBoundary as ReactErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { AriaLiveRegion } from '@/components/a11y/AriaLiveRegion';

function ErrorFallback({ resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <TriangleAlert size={48} className="text-destructive" />
      <AriaLiveRegion role="alert" aria-live="assertive" message="Something went wrong">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
      </AriaLiveRegion>
      <p className="text-sm text-muted-foreground">
        An unexpected error occurred. Please try again later.
      </p>
      <div className="flex gap-2">
        <Button onClick={resetErrorBoundary}>Try Again</Button>
        <Button variant="outline" asChild>
          <Link to="/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

export function ErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, info) => console.error('ErrorBoundary caught:', error, info)}
    >
      {children}
    </ReactErrorBoundary>
  );
}
