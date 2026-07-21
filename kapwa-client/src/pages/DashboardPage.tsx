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
import { StaticDashboard } from '@/components/dashboard/StaticDashboard';
import type { WidgetConfig } from '@/components/dashboard/StaticDashboard';

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
  pending_assessment: 'outline',
  in_review: 'secondary',
  approved: 'default',
  disbursed: 'secondary',
  closed: 'outline',
};

const STATUS_LABELS: Record<string, string> = {
  pending_assessment: 'Pending',
  in_review: 'In Review',
  approved: 'Approved',
  disbursed: 'Disbursed',
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
    { accessorKey: 'no', header: 'No.', cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.original.no}</span> },
    { accessorKey: 'surname', header: 'Surname' },
    { accessorKey: 'first', header: 'First' },
    { accessorKey: 'middle', header: 'Middle' },
    { accessorKey: 'gender', header: 'Gender' },
    { accessorKey: 'ageRange', header: 'Age Range', cell: ({ row }) => <Badge variant="outline">{row.original.ageRange}</Badge> },
    { accessorKey: 'category', header: 'Category', cell: ({ row }) => <Badge variant="secondary">{row.original.category}</Badge> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant={STATUS_BADGES[row.original.status] || 'outline'}>{STATUS_LABELS[row.original.status] || row.original.status}</Badge> },
    { id: 'sla', header: 'SLA', cell: ({ row }) => row.original.slaOverdue ? (
      <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        <AlertTriangle size={12} /> OVERDUE
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">On Track</span>
    )},
    { accessorKey: 'barangay', header: 'Barangay' },
    { accessorKey: 'remarks', header: 'Remarks', cell: ({ row }) => <span className="text-xs">{row.original.remarks}</span> },
    { accessorKey: 'date', header: 'Date', cell: ({ row }) => <span className="text-xs text-muted-foreground tabular-nums">{row.original.date}</span> },
    { id: 'actions', header: 'Actions', cell: ({ row }) => (
      <Button variant="ghost" size="sm" onClick={() => navigate(`/cases/${row.original.id}`)} aria-label="View Case">
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

  const widgets: WidgetConfig[] = [
    { key: 'case-status', component: <CaseStatusChart data={data?.byStatus || []} />, defaultW: 2, defaultH: 5, minH: 4 },
    { key: 'sla', component: <SlaWidget overdueCount={data?.urgentCount ?? 0} />, defaultW: 1, defaultH: 5, minH: 4 },
    { key: 'trends', component: <TrendsChart data={trends || []} />, defaultW: 2, defaultH: 5, minH: 4 },
    { key: 'barangay', component: <BarangayBreakdown cases={barangayData} />, defaultW: 1, defaultH: 5, minH: 4 },
  ];

  return (
    <PageShell title="Dashboard" description="Overview of social welfare operations and metrics." cachedAt={lastSync ?? undefined}
      actions={
        <Button size="sm" onClick={() => navigate('/intake')}>
          <Plus size={14} className="mr-1" /> New Intake
        </Button>
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

      <div className="mt-4">
        <StaticDashboard widgets={widgets} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <NeedsAttention cases={cases.map(c => ({ id: c.id, name: `${c.surname}, ${c.first}`.trim(), status: c.status }))} />
        </div>
        <div className="lg:col-span-1">
          <ActivityCalendar data={dailyCounts ?? null} year={now.getFullYear()} month={now.getMonth() + 1} />
        </div>
      </div>

      <div className="mt-4">
        <h2 className="text-lg font-semibold tracking-tight mb-3">Recent Cases</h2>
        <DataTable columns={columns} data={cases} rowCount={cases.length} pagination={pagination} onPaginationChange={setPagination} sorting={[]} />
      </div>
    </PageShell>
  );
}
