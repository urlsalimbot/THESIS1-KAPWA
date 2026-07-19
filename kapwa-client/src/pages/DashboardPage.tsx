import React, { useMemo, useState } from 'react';
import { useNavigate } from "react-router-dom";
import { TrendingUp, Clock, DollarSign, Plus } from 'lucide-react';
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
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface Stat { label: string; value: string; change: string; icon: React.ElementType; iconClass: string; }
interface CaseRow { id: string; name: string; category: string; barangay: string; remarks: string; date: string; status: string; updatedAt?: string; }
interface DashboardData {
  servedToday?: number; servedChange?: string; lastSync?: string;
  pendingReview?: number; urgentCount?: number; disbursedMonth?: number;
  beneficiaryCount?: number; recentCases?: CaseRow[];
}

interface TrendData {
  month: string; casesCreated: number; disbursed: number;
}

interface DailyCounts {
  [day: string]: { interventions: number; cases: number };
}

const PIE_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#6b7280'];

const StatusBadge = React.memo(({ status }: { status: string }) => {
  const variantMap: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
    approved: 'default', in_review: 'secondary', pending_assessment: 'outline', disbursed: 'secondary', closed: 'outline',
  };
  const labelMap: Record<string, string> = {
    pending_assessment: 'Pending', in_review: 'In Review', approved: 'Approved', disbursed: 'Disbursed', closed: 'Closed',
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
    accessorKey: 'sla', header: 'SLA', cell: ({ row }) => {
      const { updatedAt } = row.original;
      if (!updatedAt) return <span className="text-xs text-muted-foreground">&mdash;</span>;
      return <SlaTimer stageStartedAt={updatedAt} slaHours={DEFAULT_SLA_HOURS} size="sm" />;
    },
  },
  { accessorKey: 'date', header: 'Date', cell: ({ row }) => <span className="text-xs text-muted-foreground tabular-nums">{row.original.date}</span> },
];

const WORKER_ROLES = ['social_worker', 'admin'];

const offlineStats: Stat[] = [
  { label: 'Served Today', value: '0', change: 'N/A', icon: TrendingUp, iconClass: 'bg-blue-50 text-blue-700' },
  { label: 'Pending Review', value: '0', change: 'N/A', icon: Clock, iconClass: 'bg-yellow-100 text-yellow-800' },
  { label: 'Disbursed This Month', value: '₱0', change: 'N/A', icon: DollarSign, iconClass: 'bg-green-100 text-green-800' },
];

function mapStats(data: DashboardData): Stat[] {
  return [
    { label: 'Served Today', value: String(data.servedToday || 0), change: `${data.servedChange || '+0%'} from yesterday`, icon: TrendingUp, iconClass: 'bg-blue-50 text-blue-700' },
    { label: 'Pending Review', value: String(data.pendingReview || 0), change: `${data.urgentCount || 0} urgent`, icon: Clock, iconClass: 'bg-yellow-100 text-yellow-800' },
    { label: 'Disbursed This Month', value: `₱${data.disbursedMonth || 0}`, change: `${data.beneficiaryCount || 0} beneficiaries`, icon: DollarSign, iconClass: 'bg-green-100 text-green-800' },
  ];
}

const STATUS_LABELS: Record<string, string> = {
  pending_assessment: 'Pending', in_review: 'Review', approved: 'Approved', disbursed: 'Disbursed', closed: 'Closed',
};

function CalendarHeatmap({ data, year, month }: { data: DailyCounts; year: number; month: number }) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  const today = new Date();

  const weeks: { day: number; count: number }[][] = [];
  let week: { day: number; count: number }[] = [];
  for (let i = 0; i < firstDay; i++) week.push({ day: 0, count: -1 });
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const counts = data[key];
    const total = counts ? counts.interventions + counts.cases : 0;
    week.push({ day: d, count: total });
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) { while (week.length < 7) week.push({ day: 0, count: -1 }); weeks.push(week); }

  const maxCount = Math.max(1, ...Object.values(data).flatMap(d => d.cases + d.interventions));
  const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2">{monthName}</p>
      <div className="grid grid-cols-7 gap-0.5 text-[9px] leading-none">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} className="text-center text-[8px] text-muted-foreground py-0.5 font-medium">{d}</div>
        ))}
        {weeks.flat().map((cell, i) => {
          if (cell.day === 0) return <div key={i} />;
          const intensity = cell.count > 0 ? Math.min(Math.ceil((cell.count / maxCount) * 4), 4) : 0;
          const isToday = cell.day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();
          const colors = ['bg-muted', 'bg-blue-100', 'bg-blue-200', 'bg-blue-300', 'bg-blue-500'];
          return (
            <div
              key={i}
              title={`${monthName} ${cell.day}: ${cell.count} activities`}
              className={`rounded-sm h-5 flex items-center justify-center text-[8px] font-medium transition-colors ${colors[intensity]} ${isToday ? 'ring-1 ring-primary' : ''} ${cell.count > 0 ? 'text-white' : 'text-muted-foreground'}`}
            >
              {cell.day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

  const stats = useMemo(() => (data ? mapStats(data) : offlineStats), [data]);
  const cases = useMemo(() => data?.recentCases ?? [], [data]);
  const lastSync = data ? Date.now() : null;
  const loading = isLoading && WORKER_ROLES.includes(role);

  const caseStatusData = useMemo(() => {
    if (!data?.disbursedMonth && !data?.pendingReview) return null;
    return [
      { name: 'Approved', value: data?.disbursedMonth ? Math.round(Number(data.disbursedMonth) / 1000) : 0 },
      { name: 'Pending', value: data?.pendingReview || 0 },
      { name: 'Urgent', value: data?.urgentCount || 0 },
    ].filter(d => d.value > 0);
  }, [data]);

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
        <Button size="sm" onClick={() => navigate('/intake')}>
          <Plus size={14} className="mr-1" /> New Intake
        </Button>
      }>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(s => <StatCard key={s.label} stat={s} />)}
      </div>

      {/* Charts & Calendar Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        {/* Case Status Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Case Status</CardTitle>
          </CardHeader>
          <CardContent>
            {caseStatusData ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={caseStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {caseStatusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-muted-foreground py-8 text-center">No case data</p>
            )}
          </CardContent>
        </Card>

        {/* Monthly Trends */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Monthly Trends (6mo)</CardTitle>
          </CardHeader>
          <CardContent>
            {trends && trends.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={trends}>
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="casesCreated" name="Cases" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="disbursed" name="Disbursed (₱)" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-muted-foreground py-8 text-center">No trend data</p>
            )}
          </CardContent>
        </Card>

        {/* Daily Activity Calendar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Activity Calendar</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyCounts ? (
              <CalendarHeatmap data={dailyCounts} year={now.getFullYear()} month={now.getMonth() + 1} />
            ) : (
              <p className="text-xs text-muted-foreground py-8 text-center">Loading...</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Cases */}
      <h2 className="text-lg font-semibold tracking-tight mt-6 mb-3">Recent Cases</h2>

      <DataTable columns={dashboardCaseColumns} data={cases} rowCount={cases.length} pagination={pagination} onPaginationChange={setPagination} sorting={[]} />
    </PageShell>
  );
}
