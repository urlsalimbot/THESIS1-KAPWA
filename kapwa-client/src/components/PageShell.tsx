import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';
import { useCacheStaleness } from '@/hooks/use-cache-staleness';
import { AriaLiveRegion } from '@/components/a11y/AriaLiveRegion';

interface PageShellProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  cachedAt?: number;
  children: React.ReactNode;
}

export function PageShell({ title, description, actions, cachedAt, children }: PageShellProps) {
  const { isStale, ageDisplay } = useCacheStaleness(cachedAt);

  let fullDescription = description || '';
  if (isStale && ageDisplay) {
    const staleText = `Cached data — last sync ${ageDisplay} ago`;
    fullDescription = fullDescription ? `${fullDescription} — ${staleText}` : staleText;
  }

  return (
    <div className="flex flex-col gap-4 lg:gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">{title}</h1>
          {fullDescription && (
            <p className="text-sm text-muted-foreground mt-1">
              {isStale && <Clock className="inline h-3.5 w-3.5 mr-1 align-text-top" aria-hidden="true" />}
              {fullDescription}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
      {isStale && ageDisplay && (
        <AriaLiveRegion
          role="status"
          aria-live="polite"
          message={`Showing cached data — last sync ${ageDisplay} ago`}
        />
      )}
      {children}
    </div>
  );
}
