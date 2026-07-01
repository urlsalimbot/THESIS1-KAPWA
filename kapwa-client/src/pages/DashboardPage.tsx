import React, { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import { TrendingUp, RefreshCw, Clock, DollarSign } from 'lucide-react';
import { getDashboard } from '../lib/api';
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
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{stat.label}</span>
          <div className={`ml-auto rounded-full w-8 h-8 flex items-center justify-center ${stat.iconClass}`}>
            <Icon size={16} />
          </div>
        </div>
        <div className="text-2xl font-bold text-foreground font-heading">{stat.value}</div>
        <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
      </CardContent>
    </Card>
  );
});

const DEFAULT_SLA_HOURS = 48;

const dashboardCaseColumns: ColumnDef<CaseRow>[] = [
  { accessorKey: 'id', header: 'Case ID', cell: ({ row }) => <span className="text-muted-foreground">{row.original.id}</span> },
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
  { accessorKey: 'date', header: 'Date', cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.date}</span> },
];

const WORKER_ROLES = ['social_worker', 'admin'];

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role || '';
  const [stats, setStats] = useState<Stat[]>([]);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    if (WORKER_ROLES.includes(role)) {
      loadData();
    } else {
      setLoading(false);
    }
    return () => controller.abort();
  }, [role]);

  async function loadData(signal?: AbortSignal) {
    try {
      const data = await getDashboard();
      setStats([
        { label: 'Served Today', value: String(data.servedToday || 0), change: `${data.servedChange || '+0%'} from yesterday`, icon: TrendingUp, iconClass: 'bg-blue-50 text-blue-700' },
        { label: 'Sync Status', value: 'All Synced', change: `Last sync: ${data.lastSync || '2m ago'}`, icon: RefreshCw, iconClass: 'bg-blue-50 text-cyan-600' },
        { label: 'Pending Review', value: String(data.pendingReview || 0), change: `${data.urgentCount || 0} urgent`, icon: Clock, iconClass: 'bg-yellow-100 text-yellow-800' },
        { label: 'Disbursed This Month', value: `₱${data.disbursedMonth || 0}`, change: `${data.beneficiaryCount || 0} beneficiaries`, icon: DollarSign, iconClass: 'bg-green-100 text-green-800' },
      ]);
      setCases(data.recentCases || []);
      setLastSync(Date.now());
    } catch {
      setStats([
        { label: 'Served Today', value: '0', change: 'N/A', icon: TrendingUp, iconClass: 'bg-blue-50 text-blue-700' },
        { label: 'Sync Status', value: 'Offline', change: 'Check connection', icon: RefreshCw, iconClass: 'bg-blue-50 text-cyan-600' },
        { label: 'Pending Review', value: '0', change: 'N/A', icon: Clock, iconClass: 'bg-yellow-100 text-yellow-800' },
        { label: 'Disbursed This Month', value: '₱0', change: 'N/A', icon: DollarSign, iconClass: 'bg-green-100 text-green-800' },
      ]);
    }
    setLoading(false);
  }

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

  if (stats.length === 0 && !loading) {
    return (
      <PageShell title="Dashboard" description="Overview of social welfare operations and metrics.">
        <QuickActionPanel />
        <EmptyState variant="no-data" />
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

      <div className="flex items-center justify-between mt-2">
        <h3 className="text-lg font-semibold">Recent Cases</h3>
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
