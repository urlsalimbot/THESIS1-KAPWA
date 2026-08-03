import useSWR from 'swr';
import { Link } from 'react-router-dom';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { CardGridSkeleton } from '@/components/skeletons/CardGridSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Inbox, ClipboardCheck, IdCard, ArrowLeftRight } from 'lucide-react';
import { STATUS_LABELS, InterAgencyReferral, Agency } from '@/components/referrals/referral-utils';

interface DashboardData {
  agency: Agency;
  counts: {
    total: number;
    sent: number;
    received: number;
    byStatus: Record<string, number>;
  };
  recent: InterAgencyReferral[];
}

export function AgencyDashboardPage() {
  const { data, isLoading, error } = useSWR<DashboardData>(queryKeys.agencyPortal.dashboard());

  if (isLoading) {
    return (
      <PageShell title="Agency Dashboard" description="Overview of your agency's referrals">
        <CardGridSkeleton />
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell title="Agency Dashboard" description="Overview of your agency's referrals">
        <p className="text-sm text-destructive">Failed to load dashboard</p>
      </PageShell>
    );
  }

  const stats = [
    { label: 'Total', value: data?.counts.total ?? 0, icon: <ArrowLeftRight size={16} /> },
    { label: 'Sent', value: data?.counts.sent ?? 0, icon: <Inbox size={16} /> },
    { label: 'Received', value: data?.counts.received ?? 0, icon: <ClipboardCheck size={16} /> },
    { label: 'Closed', value: data?.counts.byStatus.closed ?? 0, icon: <IdCard size={16} /> },
    { label: 'Declined', value: data?.counts.byStatus.declined ?? 0, icon: <IdCard size={16} /> },
  ];

  return (
    <PageShell
      title={data?.agency.name || 'Agency Dashboard'}
      description={`${data?.agency.code || 'Agency'} — referral overview`}
    >
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {stats.map(s => (
          <div key={s.label} className="rounded-lg bg-card p-4 shadow-sm border border-border">
            <div className="flex items-center gap-2 text-primary mb-1">{s.icon}</div>
            <p className="text-2xl font-bold tabular-nums">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-6">
        <Link to="/agency/referrals">
          <Button size="sm">View Inbox</Button>
        </Link>
        <Link to="/agency/card-activities">
          <Button size="sm" variant="secondary">Log Activity</Button>
        </Link>
      </div>

      <h2 className="text-sm font-semibold mb-3">Recent Referrals</h2>
      {data?.recent.length === 0 || !data ? (
        <p className="text-sm text-muted-foreground">No referrals yet.</p>
      ) : (
        <div className="space-y-3">
          {data.recent.map(r => (
            <div key={r.id} className="rounded-lg bg-card p-4 shadow-sm border border-border space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-sm truncate">
                  {r.person ? `${r.person.firstName} ${r.person.surname}` : 'Person'}
                </p>
                <Badge variant={r.status === 'declined' ? 'destructive' : 'secondary'} className="text-[10px]">
                  {STATUS_LABELS[r.status] || r.status}
                </Badge>
              </div>
              <p className="text-sm">{r.reason}</p>
              <p className="text-xs text-muted-foreground">
                {(r.fromAgency?.name || r.fromAgencyId)} → {(r.toAgency?.name || r.toAgencyId)} ·{' '}
                {new Date(r.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
