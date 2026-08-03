import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { useAuth } from '../lib/auth-context';
import { PageShell } from '@/components/PageShell';
import { CardGridSkeleton } from '@/components/skeletons/CardGridSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { ReferralCard } from '@/components/referrals/ReferralCard';
import { CreateReferralForm } from '@/components/referrals/CreateReferralForm';
import { Agency, InterAgencyReferral } from '@/components/referrals/referral-utils';

export function AgencyReferralsPage() {
  const { user } = useAuth();
  const { mutate } = useSWRConfig();
  const [filter, setFilter] = useState<'all' | 'received' | 'sent'>('all');
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState('');

  const { data: referrals, isLoading } = useSWR<InterAgencyReferral[]>(
    queryKeys.interAgencyReferrals.inbox(),
  );
  const { data: agencies } = useSWR<Agency[]>(queryKeys.agencies.list());

  const myAgencyId = user?.agencyId;

  const visible = (referrals || []).filter(r => {
    if (filter === 'all') return true;
    if (filter === 'received') return r.toAgencyId === myAgencyId;
    return r.fromAgencyId === myAgencyId;
  });

  async function transition(id: string, action: string, body?: Record<string, string>) {
    setTransitioning(true);
    setTransitionError('');
    try {
      await api.patch(`/inter-agency-referrals/${id}/${action}`, body);
      await mutate(queryKeys.interAgencyReferrals.inbox());
    } catch (err: any) {
      setTransitionError(err?.message || 'Transition failed');
    } finally {
      setTransitioning(false);
    }
  }

  if (isLoading) {
    return (
      <PageShell title="Referrals" description="Track referrals between agencies">
        <CardGridSkeleton />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Referrals"
      description="Track referrals between agencies"
    >
      <CreateReferralForm
        agencies={agencies || []}
        onCreated={() => mutate(queryKeys.interAgencyReferrals.inbox())}
      />

      <div className="mt-4 mb-2 flex gap-1">
        {(['all', 'received', 'sent'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            {f === 'all' ? 'All' : f === 'received' ? 'Received' : 'Sent'}
          </button>
        ))}
      </div>

      {transitionError && <p className="text-xs text-destructive mb-2">{transitionError}</p>}

      {visible.length === 0 ? (
        <EmptyState variant="no-data" />
      ) : (
        <div className="space-y-3">
          {visible.map(r => (
            <ReferralCard
              key={r.id}
              referral={r}
              myAgencyId={myAgencyId}
              onTransition={transition}
              disabled={transitioning}
            />
          ))}
        </div>
      )}
    </PageShell>
  );
}
