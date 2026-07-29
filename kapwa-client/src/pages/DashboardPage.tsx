import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Clock, DollarSign, Plus, Eye, AlertTriangle, Search, Download } from 'lucide-react';
import useSWR from 'swr';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { CardGridSkeleton } from '@/components/skeletons/CardGridSkeleton';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';
import { ClaimantWidgets } from '@/components/dashboard/widgets/ClaimantWidgets';
import { MayorWidgets } from '@/components/dashboard/widgets/MayorWidgets';
import { AuditorWidgets } from '@/components/dashboard/widgets/AuditorWidgets';
import { CoordinatorWidgets } from '@/components/dashboard/widgets/CoordinatorWidgets';
import { SlaTimer } from '@/components/sla/SlaTimer';
import { StatsRow } from '@/components/dashboard/StatsRow';
import { CaseStatusChart } from '@/components/dashboard/CaseStatusChart';
import { SlaWidget } from '@/components/dashboard/SlaWidget';
import { TrendsChart } from '@/components/dashboard/TrendsChart';
import { NeedsAttention } from '@/components/dashboard/NeedsAttention';
import { BarangayBreakdown } from '@/components/dashboard/BarangayBreakdown';
import { ActivityCalendar } from '@/components/dashboard/ActivityCalendar';

interface Stat { label: string; value: string; change: string; icon: React.ElementType; iconClass: string; }
interface CaseRow {
  id: string; no: number; surname: string; first: string; middle: string;
  gender: string; ageRange: string; category: string; barangay: string;
  remarks: string; date: string; status: string; controlNo: string;
  slaOverdue?: boolean; createdAt: string;
}

interface DashboardData {
  servedToday?: number; servedChange?: string; lastSync?: string;
  pendingReview?: number; urgentCount?: number; disbursedMonth?: number;
  beneficiaryCount?: number; recentInterventions?: number;
  totalCases?: number; approvedCases?: number; disbursedCases?: number;
  byStatus?: { status: string; count: number }[];
  recentCases?: CaseRow[];
}

interface TrendData {
  month: string; casesCreated: number; disbursed: number;
}

interface DailyCounts {
  [day: string]: { interventions: number; cases: number };
}

const STATUS_BADGES: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  enrolled: 'outline',
  assessed: 'secondary',
  in_review: 'secondary',
  active: 'default',
  transitioning: 'secondary',
  closed: 'outline',
};

const STATUS_LABELS: Record<string, string> = {
  enrolled: 'Enrolled',
  assessed: 'Assessed',
  in_review: 'In Review',
  active: 'Active',
  transitioning: 'Transitioning',
  closed: 'Closed',
};

const WORKER_ROLES = ['social_worker', 'admin'];

const offlineStats: Stat[] = [
  { label: 'Served Today', value: '0', change: 'N/A', icon: TrendingUp, iconClass: 'bg-blue-50 text-blue-700' },
  { label: 'Pending Review', value: '0', change: 'N/A', icon: Clock, iconClass: 'bg-yellow-100 text-yellow-800' },
  { label: 'Disbursed This Month', value: '₱0', change: 'N/A', icon: DollarSign, iconClass: 'bg-green-100 text-green-800' },
];

export function DashboardPage() {
  const navigate = useNavigate();
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const { user } = useAuth();
  const role = user?.role || '';

  const swrKey = WORKER_ROLES.includes(role) ? queryKeys.dashboard.stats() : null;
  const { data, isLoading } = useSWR<DashboardData>(swrKey);
  const { data: trends } = useSWR<TrendData[]>(WORKER_ROLES.includes(role) ? queryKeys.dashboard.trends() : null);
  const now = new Date();
  const { data: dailyCounts } = useSWR<DailyCounts>(
    WORKER_ROLES.includes(role) ? queryKeys.dashboard.dailyCounts(now.getFullYear(), now.getMonth() + 1) : null,
  );

  const cases = useMemo(() => data?.recentCases ?? [], [data]);

  const columns: ColumnDef<CaseRow>[] = [
    { accessorKey: 'date', header: 'Date', cell: ({ row }) => <span className="text-xs text-muted-foreground tabular-nums">{row.original.date}</span> },
    { accessorKey: 'surname', header: 'Surname' },
    { accessorKey: 'first', header: 'First' },
    { accessorKey: 'middle', header: 'Middle' },
    { accessorKey: 'gender', header: 'Gender' },
    { accessorKey: 'category', header: 'Category', cell: ({ row }) => <Badge variant="secondary">{row.original.category}</Badge> },
    { accessorKey: 'barangay', header: 'Barangay' },
    { accessorKey: 'remarks', header: 'Remarks', cell: ({ row }) => <span className="text-xs">{row.original.remarks}</span> },
    { id: 'actions', header: 'Actions', cell: ({ row }) => (
      <Button variant="secondary" size="sm" onClick={() => navigate(`/cases/${row.original.id}`)} aria-label="View Case">
        <Eye size={14} className="mr-1" /> View
      </Button>
    )},
  ];
  const lastSync = data ? Date.now() : null;
  const loading = isLoading && WORKER_ROLES.includes(role);

  const barangayData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of cases) {
      const b = c.barangay || 'Unknown';
      counts[b] = (counts[b] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [cases]);

  if (loading) {
    return (
      <PageShell title="Dashboard" description="Overview of social welfare operations and metrics.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><CardGridSkeleton /></CardContent></Card>
          ))}
        </div>
        <div className="mt-6"><TableSkeleton rows={5} /></div>
      </PageShell>
    );
  }

  if (!WORKER_ROLES.includes(role)) {
    return (
      <PageShell title="Dashboard" description="Overview of social welfare operations and metrics.">
        {role === 'claimant' && <ClaimantWidgets />}
        {role === 'mayor' && <MayorWidgets />}
        {role === 'auditor' && <AuditorWidgets />}
        {role === 'coordinator' && <CoordinatorWidgets />}
        {!['claimant', 'mayor', 'auditor', 'coordinator'].includes(role) && <EmptyState variant="no-access" />}
      </PageShell>
    );
  }

  return (
    <PageShell title="Dashboard" description="Overview of social welfare operations and metrics." cachedAt={lastSync ?? undefined}
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate('/intake/referrals')}>
            Review Referrals
          </Button>
          <Button size="sm" onClick={() => navigate('/intake')}>
            <Plus size={14} className="mr-1" /> New Intake
          </Button>
        </div>
      }>

      {data && (
        <StatsRow
          servedToday={data.servedToday ?? 0}
          pendingReview={data.pendingReview ?? 0}
          urgentCount={data.urgentCount ?? 0}
          disbursedMonth={data.disbursedMonth ?? 0}
          beneficiaryCount={data.beneficiaryCount ?? 0}
          recentInterventions={data.recentInterventions ?? 0}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2"><CaseStatusChart data={data?.byStatus || []} /></div>
        <div className="lg:col-span-1"><ActivityCalendar data={dailyCounts ?? null} year={now.getFullYear()} month={now.getMonth() + 1} /></div>
        <div className="lg:col-span-2"><TrendsChart data={trends || []} /></div>
        <div className="lg:row-span-2 lg:col-span-1"><BarangayBreakdown cases={barangayData} /></div>
        <div className="lg:col-span-1"><div className="h-full overflow-y-auto" style={{ maxHeight: '300px' }}><SlaWidget overdueCount={data?.urgentCount ?? 0} /></div></div>
        <div className="lg:col-span-1"><div className="h-full"><NeedsAttention cases={cases.map(c => ({ id: c.id, name: `${c.surname}, ${c.first}`.trim(), status: c.status }))} /></div></div>
      </div>

      <div className="mt-4">
        <h2 className="text-lg font-semibold tracking-tight mb-3">Recent Cases</h2>
        <DataTable columns={columns} data={cases} rowCount={cases.length} pagination={pagination} onPaginationChange={setPagination} sorting={[]} />
      </div>
    </PageShell>
  );
}
