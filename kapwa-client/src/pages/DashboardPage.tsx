import React, { useMemo } from 'react';
import { useNavigate } from "react-router-dom";
import { TrendingUp, RefreshCw, Clock, DollarSign } from 'lucide-react';
import useSWR from 'swr';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { CardGridSkeleton } from '@/components/skeletons/CardGridSkeleton';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';
import type { ColumnDef } from '@tanstack/react-table';
import { QuickActionPanel } from '@/components/dashboard/QuickActionPanel';
import { ClaimantWidgets } from '@/components/dashboard/widgets/ClaimantWidgets';
import { MayorWidgets } from '@/components/dashboard/widgets/MayorWidgets';
import { AuditorWidgets } from '@/components/dashboard/widgets/AuditorWidgets';
import { CoordinatorWidgets } from '@/components/dashboard/widgets/CoordinatorWidgets';
import { SlaTimer } from '@/components/sla/SlaTimer';

interface Stat { label: string; value: string; change: string; icon: React.ElementType; iconClass: string; }
interface CaseRow { id: string; name: string; category: string; barangay: string; remarks: string; date: string; status: string; updatedAt?: string; }
interface DashboardData {
  servedToday?: number; servedChange?: string; lastSync?: string;
  pendingReview?: number; urgentCount?: number; disbursedMonth?: number;
  beneficiaryCount?: number; recentCases?: CaseRow[];
}

const StatusBadge = React.memo(({ status }: { status: string }) => {
  const variantMap: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
    approved: 'default',
    in_review: 'secondary',
    pending_assessment: 'outline',
    disbursed: 'secondary',
    closed: 'outline',
  };
  const labelMap: Record<string, string> = {
    pending_assessment: 'Pending',
    in_review: 'In Review',
    approved: 'Approved',
    disbursed: 'Disbursed',
    closed: 'Closed',
  };
  return <Badge variant={variantMap[status] || 'outline'}>{labelMap[status] || status}</Badge>;
});

const StatCard = React.memo(({ stat }: { stat: Stat }) => {
  const Icon = stat.icon;
  return (
    <Card className="transition-all duration-200 hover:shadow-lg hover:-translate-y-1">
      <CardContent className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{stat.label}</span>
          <div className={`ml-auto rounded-full w-9 h-9 flex items-center justify-center shadow-sm ${stat.iconClass}`}>
            <Icon size={20} />
          </div>
        </div>
        <div className="text-3xl font-bold text-foreground font-heading tracking-tight tabular-nums mb-1">{stat.value}</div>
        <p className="text-xs text-muted-foreground">{stat.change}</p>
      </CardContent>
    </Card>
  );
});

const DEFAULT_SLA_HOURS = 48;

const dashboardCaseColumns: ColumnDef<CaseRow>[] = [
  { accessorKey: 'id', header: 'Case ID', cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.original.id}</span> },
  { accessorKey: 'name', header: 'Name', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
  { accessorKey: 'category', header: 'Category', cell: ({ row }) => <Badge variant="secondary">{row.original.category}</Badge> },
  { accessorKey: 'barangay', header: 'Barangay' },
  { accessorKey: 'remarks', header: 'Remarks', cell: ({ row }) => <span className="text-xs">{row.original.remarks}</span> },
  { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  {
    accessorKey: 'sla',
    header: 'SLA',
    cell: ({ row }) => {
      const { updatedAt } = row.original;
      if (!updatedAt) return <span className="text-xs text-muted-foreground">&mdash;</span>;
      return (
        <SlaTimer
          stageStartedAt={updatedAt}
          slaHours={DEFAULT_SLA_HOURS}
          size="sm"
        />
      );
    },
  },
  { accessorKey: 'date', header: 'Date', cell: ({ row }) => <span className="text-xs text-muted-foreground tabular-nums">{row.original.date}</span> },
];

const WORKER_ROLES = ['social_worker', 'admin'];

const offlineStats: Stat[] = [
  { label: 'Served Today', value: '0', change: 'N/A', icon: TrendingUp, iconClass: 'bg-blue-50 text-blue-700' },
  { label: 'Sync Status', value: 'Offline', change: 'Check connection', icon: RefreshCw, iconClass: 'bg-blue-50 text-cyan-600' },
  { label: 'Pending Review', value: '0', change: 'N/A', icon: Clock, iconClass: 'bg-yellow-100 text-yellow-800' },
  { label: 'Disbursed This Month', value: '₱0', change: 'N/A', icon: DollarSign, iconClass: 'bg-green-100 text-green-800' },
];

function mapStats(data: DashboardData): Stat[] {
  return [
    { label: 'Served Today', value: String(data.servedToday || 0), change: `${data.servedChange || '+0%'} from yesterday`, icon: TrendingUp, iconClass: 'bg-blue-50 text-blue-700' },
    { label: 'Sync Status', value: 'All Synced', change: `Last sync: ${data.lastSync || '2m ago'}`, icon: RefreshCw, iconClass: 'bg-blue-50 text-cyan-600' },
    { label: 'Pending Review', value: String(data.pendingReview || 0), change: `${data.urgentCount || 0} urgent`, icon: Clock, iconClass: 'bg-yellow-100 text-yellow-800' },
    { label: 'Disbursed This Month', value: `₱${data.disbursedMonth || 0}`, change: `${data.beneficiaryCount || 0} beneficiaries`, icon: DollarSign, iconClass: 'bg-green-100 text-green-800' },
  ];
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role || '';

  // Conditional null key — non-worker roles (claimant/mayor/auditor/coordinator) skip the fetch.
  // The api.get is bound globally in routes.tsx (SWRConfig fetcher) — no fetcher prop here.
  const swrKey = WORKER_ROLES.includes(role) ? queryKeys.dashboard.stats() : null;
  const { data, isLoading } = useSWR<DashboardData>(swrKey);

  // Memoize so the stats array reference is stable across renders (preserves React.memo on StatCard).
  const stats = useMemo(() => (data ? mapStats(data) : offlineStats), [data]);
  const cases = useMemo(() => data?.recentCases ?? [], [data]);
  const lastSync = data ? Date.now() : null;
  // Only show the skeleton while a worker-role fetch is in flight; non-worker roles skip straight to their widget.
  const loading = isLoading && WORKER_ROLES.includes(role);

  if (loading) {
    return (
      <PageShell title="Dashboard" description="Overview of social welfare operations and metrics.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <CardGridSkeleton />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-6">
          <TableSkeleton rows={5} />
        </div>
      </PageShell>
    );
  }

  if (!WORKER_ROLES.includes(role)) {
    return (
      <PageShell
        title="Dashboard"
        description="Overview of social welfare operations and metrics."
      >
        {role === 'claimant' && <ClaimantWidgets />}
        {role === 'mayor' && <MayorWidgets />}
        {role === 'auditor' && <AuditorWidgets />}
        {role === 'coordinator' && <CoordinatorWidgets />}
        {!['claimant', 'mayor', 'auditor', 'coordinator'].includes(role) && (
          <EmptyState variant="no-access" />
        )}
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Dashboard"
      description="Overview of social welfare operations and metrics."
      cachedAt={lastSync ?? undefined}
    >
      <QuickActionPanel />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(s => <StatCard key={s.label} stat={s} />)}
      </div>

      <div className="flex items-center justify-between mt-6 mb-3">
        <h3 className="text-lg font-semibold tracking-tight">Recent Cases</h3>
        <Button variant="outline" size="sm" onClick={() => navigate('/cases')}>
          View All Cases
        </Button>
      </div>

      <DataTable
        columns={dashboardCaseColumns}
        data={cases}
        rowCount={cases.length}
        pagination={{ pageIndex: 0, pageSize: 10 }}
        sorting={[]}
      />
    </PageShell>
  );
}
