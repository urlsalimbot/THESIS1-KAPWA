import { ArrowLeft } from 'lucide-react';
import { Clock } from 'lucide-react';
import { useCacheStaleness } from '@/hooks/use-cache-staleness';
import { AriaLiveRegion } from '@/components/a11y/AriaLiveRegion';
import { PageInfoProvider } from '@/lib/page-info-context';
import { Button } from '@/components/ui/button';

interface BackTo {
  label: string;
  onClick: () => void;
}

interface PageShellProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  backTo?: BackTo;
  cachedAt?: number;
  children: React.ReactNode;
}

export function PageShell({ title, description, actions, backTo, cachedAt, children }: PageShellProps) {
  const { isStale, ageDisplay } = useCacheStaleness(cachedAt);

  let fullDescription = description || '';
  if (isStale && ageDisplay) {
    const staleText = `Cached data — last sync ${ageDisplay} ago`;
    fullDescription = fullDescription ? `${fullDescription} — ${staleText}` : staleText;
  }

  return (
    <div className="flex flex-col gap-3 lg:gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {backTo && (
            <Button variant="ghost" size="sm" onClick={backTo.onClick} className="shrink-0 -ml-1.5">
              <ArrowLeft size={16} className="mr-1" /> {backTo.label}
            </Button>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-bold font-heading text-foreground truncate">{title}</h1>
            {fullDescription && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {isStale && <Clock size={14} className="inline mr-1 align-text-top" aria-hidden="true" />}
                {fullDescription}
              </p>
            )}
          </div>
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
      <PageInfoProvider value={{ title, description: fullDescription }}>
        {children}
      </PageInfoProvider>
    </div>
  );
}
