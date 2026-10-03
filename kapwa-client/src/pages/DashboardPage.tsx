import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Clock, DollarSign, Plus, Eye, AlertTriangle, Search, Download , ListChecks
} from 'lucide-react';
import useSWR from 'swr';
import { queryKeys } from '../lib/query-keys';
import { categoryLabel, statusLabel } from '@/i18n/display';
import { formatDateTime } from '@/lib/format';
import { PageShell } from '@/components/PageShell';
import { CardGridSkeleton } from '@/components/skeletons/CardGridSkeleton';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';
import { downloadMonthlyFunds, downloadSummaryReport } from '@/lib/api';
import type { ColumnDef } from '@tanstack/react-table';
import { ClaimantWidgets } from '@/components/dashboard/widgets/ClaimantWidgets';
import { CoordinatorWidgets } from '@/components/dashboard/widgets/CoordinatorWidgets';
import { SlaTimer } from '@/components/sla/SlaTimer';
import { StatsRow } from '@/components/dashboard/StatsRow';
import { CaseStatusChart } from '@/components/dashboard/CaseStatusChart';
import { SlaWidget } from '@/components/dashboard/SlaWidget';
import { TrendsChart, type TrendRange, TREND_RANGES } from '@/components/dashboard/TrendsChart';
import { NeedsAttention } from '@/components/dashboard/NeedsAttention';
import { BarangayBreakdown } from '@/components/dashboard/BarangayBreakdown';
import { ActivityCalendar } from '@/components/dashboard/ActivityCalendar';
import { CaseCategoryCell } from '@/components/case-category-cell';

interface Stat { label: string; value: string; change: string; icon: React.ElementType; iconClass: string; }
interface CaseRow {
  id: string; no: number; surname: string; first: string; middle: string;
  gender: string; ageRange: string; category: string; caseCategory?: string[]; barangay: string;
  date: string; status: string; controlNo: string;
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

const WORKER_ROLES = ['social_worker', 'admin'];

export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role || '';

  const offlineStats: Stat[] = [
    { label: t('dashboard.servedToday', 'Served Today'), value: '0', change: 'N/A', icon: TrendingUp, iconClass: 'bg-primary/5 text-primary' },
    { label: t('dashboard.pendingReview', 'Pending Review'), value: '0', change: 'N/A', icon: Clock, iconClass: 'bg-yellow-100 text-yellow-800' },
    { label: t('dashboard.disbursedThisMonth', 'Disbursed This Month'), value: '₱0', change: 'N/A', icon: DollarSign, iconClass: 'bg-emerald-100 text-emerald-800' },
  ];

  const [range, setRange] = useState<TrendRange>('6m');
  const swrKey = WORKER_ROLES.includes(role) ? queryKeys.dashboard.stats(range) : null;
  const { data, isLoading } = useSWR<DashboardData>(swrKey);
  const now = new Date();
  const { data: dailyCounts } = useSWR<DailyCounts>(
    WORKER_ROLES.includes(role) ? queryKeys.dashboard.dailyCounts(now.getFullYear(), now.getMonth() + 1) : null,
  );

  const cases = useMemo(() => data?.recentCases ?? [], [data]);

  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [summaryYear, setSummaryYear] = useState(now.getFullYear());
  const [summarySemester, setSummarySemester] = useState(Math.floor(now.getMonth() / 6) + 1);
  const [summaryExporting, setSummaryExporting] = useState(false);

  async function handleExportSummary() {
    if (summaryExporting) return;
    setSummaryExporting(true);
    setExportError(null);
    try {
      await downloadSummaryReport(summaryYear, summarySemester);
    } catch (err: any) {
      setExportError(err.message || t('dashboard.exportFailed', 'Export failed'));
      setTimeout(() => setExportError(null), 4000);
    } finally {
      setSummaryExporting(false);
    }
  }

  const summaryExportControls = (
    <>
      <select aria-label={t('reports.summaryYear', 'Summary report year')} value={summaryYear}
        onChange={(e) => setSummaryYear(Number(e.target.value))}
        className="h-8 rounded-md border bg-background px-2 text-xs">
        {[0, 1, 2, 3].map((d) => { const y = now.getFullYear() - d; return <option key={y} value={y}>{y}</option>; })}
      </select>
      <select aria-label={t('reports.summarySemester', 'Summary report semester')} value={summarySemester}
        onChange={(e) => setSummarySemester(Number(e.target.value))}
        className="h-8 rounded-md border bg-background px-2 text-xs">
        <option value={1}>{t('reports.semester1', '1st Semester (Q1+Q2)')}</option>
        <option value={2}>{t('reports.semester2', '2nd Semester (Q3+Q4)')}</option>
      </select>
      <Button size="sm" variant="outline" onClick={handleExportSummary} disabled={summaryExporting}>
        <Download size={14} className="mr-1" /> {summaryExporting ? t('dashboard.generating', 'Generating...') : t('reports.exportSummary', 'Export Summary Report')}
      </Button>
    </>
  );

  async function handleExportFundUtilization() {
    if (exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      await downloadMonthlyFunds(currentMonth);
    } catch (err: any) {
      setExportError(err.message || t('dashboard.exportFailed', 'Export failed'));
      setTimeout(() => setExportError(null), 4000);
    } finally {
      setExporting(false);
    }
  }

  const fundUtilizationButton = (
    <Button size="sm" variant="outline" onClick={handleExportFundUtilization} disabled={exporting}>
      <Download size={14} className="mr-1" /> {exporting ? t('dashboard.generating', 'Generating...') : t('dashboard.exportFundUtilization', 'Export Fund Utilization')}
    </Button>
  );

  const columns: ColumnDef<CaseRow>[] = [
    { accessorKey: 'date', header: t('dashboard.date', 'Date'), cell: ({ row }) => <span className="text-xs text-muted-foreground tabular-nums">{formatDateTime(row.original.date)}</span> },
    { accessorKey: 'surname', header: t('dashboard.surname', 'Surname') },
    { accessorKey: 'first', header: t('dashboard.firstName', 'First') },
    { accessorKey: 'middle', header: t('dashboard.middleName', 'Middle') },
    { accessorKey: 'gender', header: t('dashboard.gender', 'Gender') },
    { accessorKey: 'category', header: t('dashboard.category', 'Category'), cell: ({ row }) => <Badge variant="secondary">{categoryLabel(t, row.original.category)}</Badge> },
    { accessorKey: 'caseCategory', header: t('dashboard.caseCategory', 'Case Category'), cell: ({ row }) => <CaseCategoryCell services={row.original.caseCategory} /> },
    { accessorKey: 'barangay', header: t('dashboard.barangay', 'Barangay') },
    { accessorKey: 'status', header: t('dashboard.statusColumn', 'Status'), cell: ({ row }) => <Badge variant={STATUS_BADGES[row.original.status] || 'outline'}>{statusLabel(t, row.original.status)}</Badge> },
    { id: 'actions', header: t('dashboard.actions', 'Actions'), cell: ({ row }) => (
      <Button variant="secondary" size="sm" onClick={() => navigate(`/cases/${row.original.id}`)} aria-label={t('dashboard.viewCase', 'View Case')}>
        <Eye size={14} className="mr-1" /> {t('dashboard.view', 'View')}
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
      <PageShell title={t('dashboard.title', 'Dashboard')} description={t('dashboard.description', 'Overview of social welfare operations and metrics.')}>
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
    // The mayor/auditor dashboards went with the roles. Any role value still
    // reaching here that is none of the four (a stale session from before the
    // sunset) is shown the EmptyState rather than a blank page.
    return (
      <PageShell title={t('dashboard.title', 'Dashboard')} description={t('dashboard.description', 'Overview of social welfare operations and metrics.')}>
        {role === 'claimant' && <ClaimantWidgets />}
        {role === 'coordinator' && <CoordinatorWidgets />}
        {!['claimant', 'coordinator'].includes(role) && <EmptyState variant="no-access" />}
      </PageShell>
    );
  }

  return (
    <PageShell title={t('dashboard.title', 'Dashboard')} description={t('dashboard.description', 'Overview of social welfare operations and metrics.')} cachedAt={lastSync ?? undefined}
      actions={
        <div className="flex gap-2">
          {role === 'admin' && (
            <>
              {fundUtilizationButton}
              {exportError && <span className="text-xs text-destructive self-center">{exportError}</span>}
            </>
          )}
          <Button size="sm" variant="outline" onClick={() => navigate('/intake/referrals')}>
            {t('dashboard.reviewReferrals', 'Review Referrals')}
          </Button>
          <Button size="sm" onClick={() => navigate('/intake')}>
            <Plus size={14} className="mr-1" /> {t('dashboard.newIntake', 'New Intake')}
          </Button>
        </div>
      }>

      {/* The range selector belongs to the whole dashboard, not to the trends
          card: it filters the stats, the status chart, the barangay breakdown
          and the below table through rangeStart on the server. TrendsChart is
          fed the same value so its window matches the numbers it sits beside. */}
      <div className="mt-2 mb-1 flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium text-muted-foreground">{t('dashboard.trendRange', 'Trend range')}</span>
        <div className="flex items-center rounded-md border border-border p-0.5 bg-muted/30" role="group" aria-label={t('dashboard.trendRange', 'Trend range')}>
          {TREND_RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRange(r.value)}
              aria-pressed={range === r.value}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                range === r.value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t(r.labelKey, r.label)}
            </button>
          ))}
        </div>
      </div>

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
        <div className="lg:col-span-2"><TrendsChart range={range} /></div>
        <div className="lg:row-span-2 lg:col-span-1"><BarangayBreakdown cases={barangayData} /></div>
        <div className="lg:col-span-1"><div className="h-full overflow-y-auto" style={{ maxHeight: '300px' }}><SlaWidget overdueCount={data?.urgentCount ?? 0} /></div></div>
        <div className="lg:col-span-1"><div className="h-full"><NeedsAttention cases={cases.map(c => ({ id: c.id, name: `${c.surname}, ${c.first}`.trim(), status: c.status }))} /></div></div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold tracking-tight">{t('dashboard.recentCases', 'Recent Cases')}</h2>
          <Button variant="outline" size="sm" onClick={() => navigate('/tracker')}>
            <ListChecks size={14} className="mr-1.5" /> {t('dashboard.openTracker', 'Open Tracker')}
          </Button>
        </div>
        <DataTable columns={columns} data={cases} rowCount={cases.length} pagination={{ pageIndex: 0, pageSize: cases.length || 1 }} sorting={[]} showPagination={false} />
      </div>

      {/* The summary export sits after the dashboard elements rather than in
          the page header: the report is generated from a chosen year and
          semester, not from the data on this page, so its controls read closer
          to a footer action than a header filter. */}
      {(role === 'admin' || role === 'social_worker') && (
        <div className="mt-4 rounded-xl border bg-card px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-medium text-foreground">
            {t('reports.exportSummary', 'Export Summary Report')}
          </span>
          <div className="flex gap-2 items-center">
            <select aria-label={t('reports.summaryYear', 'Summary report year')} value={summaryYear}
              onChange={(e) => setSummaryYear(Number(e.target.value))}
              className="h-8 rounded-md border bg-background px-2 text-xs">
              {[0, 1, 2, 3].map((d) => { const y = now.getFullYear() - d; return <option key={y} value={y}>{y}</option>; })}
            </select>
            <select aria-label={t('reports.summarySemester', 'Summary report semester')} value={summarySemester}
              onChange={(e) => setSummarySemester(Number(e.target.value))}
              className="h-8 rounded-md border bg-background px-2 text-xs">
              <option value={1}>{t('reports.semester1', '1st Semester (Q1+Q2)')}</option>
              <option value={2}>{t('reports.semester2', '2nd Semester (Q3+Q4)')}</option>
            </select>
            <Button size="sm" variant="outline" onClick={handleExportSummary} disabled={summaryExporting}>
              <Download size={14} className="mr-1" /> {summaryExporting ? t('dashboard.generating', 'Generating...') : t('reports.exportSummary', 'Export Summary Report')}
            </Button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
