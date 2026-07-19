import { useState, type ReactNode } from 'react';
import { ErrorBoundary as ReactErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { AlertTriangle, WifiOff, RefreshCw, LayoutDashboard, ChevronDown, ChevronRight, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';

function isOfflineError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (error instanceof Error) {
    return error.name === 'TypeError' && /fetch|network|failed to fetch/i.test(error.message);
  }
  return false;
}

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (isOfflineError(error)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-lg border-destructive/20">
          <CardHeader className="flex flex-col items-center gap-4 pt-10">
            <div className="rounded-full bg-amber-100 p-4">
              <WifiOff size={40} className="text-amber-600" />
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-xl font-semibold text-foreground">You're Offline</h2>
              <p className="text-sm text-muted-foreground px-4">
                Your device lost connection. Some features may be unavailable until you reconnect.
              </p>
            </div>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={resetErrorBoundary} className="gap-2">
              <RefreshCw size={16} />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="w-full max-w-lg shadow-lg border-destructive/20">
        <CardHeader className="flex flex-col items-center gap-4 pt-10">
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertTriangle size={40} className="text-destructive" />
          </div>
          <div className="text-center space-y-1">
            <h2 className="text-xl font-semibold text-foreground">Something went wrong</h2>
            <p className="text-sm text-muted-foreground px-4">
              An unexpected error occurred. Our team has been notified.
            </p>
          </div>
        </CardHeader>
        <CardContent className="flex justify-center gap-3">
          <Button onClick={resetErrorBoundary} className="gap-2">
            <RefreshCw size={16} />
            Try Again
          </Button>
          <Button variant="outline" asChild>
            <Link to="/dashboard" className="gap-2">
              <LayoutDashboard size={16} />
              Dashboard
            </Link>
          </Button>
        </CardContent>
        {(error != null) && (
          <CardFooter className="flex-col items-stretch border-t px-6 py-4">
            <button
              onClick={() => setShowDetails(v => !v)}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showDetails ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Bug size={14} />
              Error Details
            </button>
            {showDetails && (() => {
              const err = error instanceof Error ? error : new Error(String(error));
              return (
                <pre className="mt-3 rounded-lg bg-muted p-4 text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {err.name}: {err.message}
                  {'\n\n'}
                  {err.stack}
                </pre>
              );
            })()}
          </CardFooter>
        )}
      </Card>
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
