import React from 'react';
import { TriangleAlert, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { AriaLiveRegion } from '@/components/a11y/AriaLiveRegion';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const isNetworkError =
        !navigator.onLine ||
        (this.state.error?.message ?? '').toLowerCase().includes('fetch') ||
        this.state.error?.name === 'TypeError';

      if (isNetworkError) {
        return (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <WifiOff size={48} className="text-muted-foreground" />
            <AriaLiveRegion role="alert" aria-live="assertive" message="You are offline">
              <h2 className="text-lg font-semibold">You are offline</h2>
            </AriaLiveRegion>
            <p className="text-sm text-muted-foreground">
              Please check your internet connection and try again.
            </p>
            <Button
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Retry
            </Button>
          </div>
        );
      }

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
            <Button
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try Again
            </Button>
            <Button variant="outline" asChild>
              <Link to="/dashboard">Go to Dashboard</Link>
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
