import useSWR from 'swr';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { CardGridSkeleton } from '@/components/skeletons/CardGridSkeleton';
import { Building2 } from 'lucide-react';

export function AgencyProfilePage() {
  const { data: agency, isLoading } = useSWR<{ id: string; code: string; name: string; type?: string; contactInfo?: Record<string, unknown> | null }>(
    queryKeys.agencyPortal.profile(),
  );

  if (isLoading) {
    return (
      <PageShell title="Agency Profile" description="Your agency information">
        <CardGridSkeleton />
      </PageShell>
    );
  }

  return (
    <PageShell
      title={agency?.name || 'Agency Profile'}
      description="Your agency information"
    >
      <div className="rounded-lg bg-card p-6 shadow-sm border border-border space-y-3 max-w-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
            <Building2 size={24} className="text-primary-foreground" />
          </div>
          <div>
            <p className="font-semibold text-lg">{agency?.name}</p>
            <p className="text-xs text-muted-foreground">{agency?.code}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Type</p>
            <p>{agency?.type || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Contact</p>
            <p>{agency?.contactInfo ? JSON.stringify(agency.contactInfo) : '—'}</p>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
