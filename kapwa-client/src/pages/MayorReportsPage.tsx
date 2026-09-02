import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp, Users, DollarSign, Clock, CheckCircle, AlertTriangle, Download,
  FileBarChart2, LayoutGrid, UserRound, Send, CalendarRange, Filter, X, RefreshCw,
} from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DataTable } from '@/components/data-table';
import type { ColumnDef, PaginationState, SortingState } from '@tanstack/react-table';
import { queryKeys } from '../lib/query-keys';
import { api } from '../lib/api';
import { downloadMonthlyFunds } from '../lib/api';
import { DataTableColumnHeader } from '@/components/data-table/DataTableColumnHeader';
import { cn } from '@/lib/utils';

const fmtPeso = (n: number | string | undefined | null) =>
  `₱${Number(n || 0).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const fmtLabel = (d?: string) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

type Preset = 'all' | 'ytd' | '6m' | '3m' | 'thisMonth' | 'lastMonth';

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'all', label: 'All Time' },
  { key: 'ytd', label: 'YTD' },
  { key: '6m', label: '6 Months' },
  { key: '3m', label: '3 Months' },
  { key: 'thisMonth', label: 'This Month' },
  { key: 'lastMonth', label: 'Last Month' },
];

function presetToRange(p: Preset): { from?: string; to?: string } {
  const now = new Date();
  switch (p) {
    case 'ytd': return { from: isoDate(new Date(now.getFullYear(), 0, 1)), to: isoDate(now) };
    case '6m': { const d = new Date(now); d.setMonth(d.getMonth() - 6); return { from: isoDate(d), to: isoDate(now) }; }
    case '3m': { const d = new Date(now); d.setMonth(d.getMonth() - 3); return { from: isoDate(d), to: isoDate(now) }; }
    case 'thisMonth': return { from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoDate(now) };
    case 'lastMonth': {
      const f = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: isoDate(f), to: isoDate(e) };
    }
    default: return {};
  }
}

const SORTABLE_COLUMN = (key: string, label: string): ColumnDef<any> => ({
  accessorKey: key,
  header: ({ column }) => <DataTableColumnHeader column={column} title={label} />,
  cell: ({ getValue }) => <span className="text-sm">{String((getValue() as string | number | null | undefined) ?? '')}</span>,
});

const AMOUNT_COLUMN = (key: string, label: string): ColumnDef<any> => ({
  accessorKey: key,
  header: ({ column }) => <DataTableColumnHeader column={column} title={label} />,
  cell: ({ getValue }) => <span className="text-sm tabular-nums">{fmtPeso(getValue() as string | number | null | undefined)}</span>,
});

const COUNT_COLUMN = (key: string, label: string): ColumnDef<any> => ({
  accessorKey: key,
  header: ({ column }) => <DataTableColumnHeader column={column} title={label} />,
  cell: ({ getValue }) => <span className="text-sm tabular-nums">{String((getValue() as string | number | null | undefined) ?? 0)}</span>,
});

function EmptyHint({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

export function MayorReportsPage() {
  const { t } = useTranslation();
  const [preset, setPreset] = useState<Preset>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const isCustom = Boolean(customFrom || customTo);
  const range = isCustom
    ? { from: customFrom || undefined, to: customTo || undefined }
    : presetToRange(preset);

  // SWR key carries the period for cache identity; the fetcher maps it to
  // query params (array keys are otherwise joined into the URL path).
  const { data: metrics, isLoading: loading, isValidating } = useSWR(
    queryKeys.dashboard.mayorReports(range.from, range.to),
    ([, , , start, end]: readonly string[]) => {
      const params = new URLSearchParams();
      if (start !== 'all') params.set('startDate', start);
      if (end !== 'all') params.set('endDate', end);
      const qs = params.toString();
      return api.get<any>(`/dashboard/reports/mayor${qs ? `?${qs}` : ''}`);
    },
  );

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const periodLabel = range.from || range.to
    ? `${fmtLabel(range.from)} – ${fmtLabel(range.to)}`
    : t('reports.allTime', 'All time');

  async function handleExportFundUtilization() {
    if (exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      await downloadMonthlyFunds(currentMonth, range.from, range.to);
    } catch (err: any) {
      setExportError(err.message || t('dashboard.exportFailed', 'Export failed'));
      setTimeout(() => setExportError(null), 4000);
    } finally {
      setExporting(false);
    }
  }

  const byProgramCols = useMemo<ColumnDef<any>[]>(() => [
    SORTABLE_COLUMN('program', t('reports.program', 'Program')),
    COUNT_COLUMN('beneficiaries', t('reports.beneficiaries', 'Beneficiaries')),
    COUNT_COLUMN('interventions', t('reports.interventions', 'Interventions')),
    AMOUNT_COLUMN('amount', t('reports.amount', 'Total Amount')),
    { accessorKey: 'amount', header: t('reports.avgAmount', 'Avg / Intervention'), cell: ({ row }) => {
      const amt = Number(row.original.amount || 0);
      const n = Number(row.original.interventions || 0);
      return <span className="text-sm tabular-nums">{n > 0 ? fmtPeso(amt / n) : '—'}</span>;
    } },
  ], [t]);

  const fundSourceCols = useMemo<ColumnDef<any>[]>(() => [
    SORTABLE_COLUMN('fund_source', t('reports.fundSource', 'Fund Source')),
    COUNT_COLUMN('interventions', t('reports.interventions', 'Interventions')),
    AMOUNT_COLUMN('amount', t('reports.amount', 'Total Amount')),
  ], [t]);

  const simpleCountCols = (key: string, label: string): ColumnDef<any>[] => [
    SORTABLE_COLUMN(key, label),
    COUNT_COLUMN('count', t('reports.beneficiaries', 'Beneficiaries')),
    { accessorKey: 'count', header: t('reports.share', 'Share'), cell: ({ row, table }) => {
      const rows = table.options.data;
      const total = rows.reduce((s, r) => s + Number(r.count || 0), 0);
      const v = Number(row.original.count || 0);
      return <span className="text-sm tabular-nums">{total > 0 ? `${Math.round((v / total) * 100)}%` : '—'}</span>;
    } },
  ];

  const referralCols = useMemo<ColumnDef<any>[]>(() => [
    SORTABLE_COLUMN('agency', t('reports.agency', 'Agency')),
    COUNT_COLUMN('total', t('reports.total', 'Total')),
    COUNT_COLUMN('referred', t('reports.referred', 'Referred')),
    COUNT_COLUMN('accepted', t('reports.accepted', 'Accepted')),
    COUNT_COLUMN('declined', t('reports.declined', 'Declined')),
    COUNT_COLUMN('completed', t('reports.completed', 'Completed')),
  ], [t]);

  const trendCols = useMemo<ColumnDef<any>[]>(() => [
    SORTABLE_COLUMN('month', t('reports.month', 'Month')),
    COUNT_COLUMN('casesCreated', t('reports.casesCreated', 'Cases Created')),
    AMOUNT_COLUMN('transitioning', t('reports.disbursed', 'Disbursed')),
  ], [t]);

  const statusCols = useMemo<ColumnDef<any>[]>(() => [
    SORTABLE_COLUMN('status', t('reports.status', 'Status')),
    COUNT_COLUMN('count', t('reports.cases', 'Cases')),
  ], [t]);

  const statCards = metrics ? [
    { label: t('dashboard.totalCases', 'Total Cases'), value: String(metrics.totalCases || 0), icon: TrendingUp, color: 'bg-blue-50 text-blue-700' },
    { label: t('dashboard.uniqueHouseholds', 'Unique Households'), value: String(metrics.uniqueHouseholds || 0), icon: Users, color: 'bg-green-100 text-green-800' },
    { label: t('dashboard.fundUtilization', 'Fund Utilization'), value: fmtPeso(metrics.fundUtilization), icon: DollarSign, color: 'bg-blue-50 text-cyan-600' },
    { label: t('reports.beneficiariesServed', 'Beneficiaries Served'), value: String(metrics.beneficiariesServed ?? 0), icon: UserRound, color: 'bg-indigo-50 text-indigo-700' },
    { label: t('dashboard.servedToday', 'Served Today'), value: String(metrics.servedToday || 0), icon: Clock, color: 'bg-yellow-100 text-yellow-800' },
    { label: t('reports.recentInterventions', 'Interventions (7d)'), value: String(metrics.recentInterventions || 0), icon: FileBarChart2, color: 'bg-orange-50 text-orange-700' },
  ] : [];

  if (loading) return <div className="p-8 text-center text-muted-foreground">{t('dashboard.loadingReports', 'Loading reports...')}</div>;

  if (!metrics) {
    return (
      <PageShell title={t('dashboard.reportsTitle', 'Reports')} description={t('dashboard.reportsDescription', 'Municipal program and compliance overview')}>
        <div className="p-8 text-center text-muted-foreground">{t('dashboard.noDataPeriod', 'No data available for the selected period.')}</div>
      </PageShell>
    );
  }

  return (
    <PageShell title={t('dashboard.reportsTitle', 'Reports')} description={t('dashboard.reportsDescription', 'Municipal program and compliance overview')}>
      {/* Period filter bar */}
      <div className="no-print rounded-xl border bg-card p-3 mb-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide mr-1">
            <Filter size={13} /> {t('reports.period', 'Period')}
          </span>
          <div className="flex flex-wrap gap-1" role="group" aria-label={t('reports.periodPresets', 'Period presets')}>
            {PRESETS.map(p => (
              <button
                key={p.key}
                type="button"
                onClick={() => { setPreset(p.key); setCustomFrom(''); setCustomTo(''); }}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                  !isCustom && preset === p.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
                aria-pressed={!isCustom && preset === p.key}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 ml-1" aria-label={t('reports.customRange', 'Custom date range')}>
            <Input type="date" aria-label={t('reports.fromDate', 'From date')} className="h-8 w-36 text-xs"
              value={customFrom} onChange={e => { setCustomFrom(e.target.value); setPreset('all'); }} />
            <span className="text-muted-foreground text-xs">–</span>
            <Input type="date" aria-label={t('reports.toDate', 'To date')} className="h-8 w-36 text-xs"
              value={customTo} onChange={e => { setCustomTo(e.target.value); setPreset('all'); }} />
            {isCustom && (
              <button type="button" onClick={() => { setCustomFrom(''); setCustomTo(''); setPreset('all'); }}
                className="p-1 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground" aria-label={t('reports.clearRange', 'Clear custom range')}>
                <X size={14} />
              </button>
            )}
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarRange size={13} />
            <span className="font-medium text-foreground">{periodLabel}</span>
            {isValidating && <RefreshCw size={12} className="animate-spin" aria-label={t('reports.updating', 'Updating')} />}
          </span>
        </div>
      </div>

      <div className="no-print flex items-center gap-2 mb-4">
        <Button size="sm" onClick={handleExportFundUtilization} disabled={exporting}>
          <Download size={14} className="mr-1" /> {exporting ? t('dashboard.generating', 'Generating...') : t('dashboard.exportFundUtilization', 'Export Fund Utilization')}
        </Button>
        <span className="text-xs text-muted-foreground">{periodLabel}</span>
        {exportError && <span className="text-xs text-red-600">{exportError}</span>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        {statCards.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-muted-foreground text-xs uppercase tracking-wide">{s.label}</span>
                <div className={`ml-auto rounded-full w-8 h-8 flex items-center justify-center ${s.color}`}>
                  <Icon size={16} />
                </div>
              </div>
              <div className="text-2xl font-bold text-foreground">{s.value}</div>
            </div>
          );
        })}
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
          <TabsTrigger value="overview"><LayoutGrid size={14} className="mr-1" /> {t('reports.overview', 'Overview')}</TabsTrigger>
          <TabsTrigger value="programs"><FileBarChart2 size={14} className="mr-1" /> {t('reports.byProgram', 'By Program')}</TabsTrigger>
          <TabsTrigger value="demographics"><UserRound size={14} className="mr-1" /> {t('reports.demographics', 'Demographics')}</TabsTrigger>
          <TabsTrigger value="funds"><DollarSign size={14} className="mr-1" /> {t('reports.fundSources', 'Fund Sources')}</TabsTrigger>
          <TabsTrigger value="referrals"><Send size={14} className="mr-1" /> {t('reports.referrals', 'Referrals')}</TabsTrigger>
          <TabsTrigger value="trends"><CalendarRange size={14} className="mr-1" /> {t('reports.trends', 'Trends')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <h2 className="font-semibold text-sm mb-3">{t('dashboard.caseStatusDistribution', 'Case Status Distribution')}</h2>
            {metrics.caseStatusDistribution?.length ? (
              <DataTable columns={statusCols} data={metrics.caseStatusDistribution}
                rowCount={metrics.caseStatusDistribution.length} pagination={pagination} onPaginationChange={setPagination}
                sorting={sorting} onSortingChange={setSorting} />
            ) : <EmptyHint label={t('reports.noDataPeriod', 'No cases in this period.')} />}
          </div>
          <div className="rounded-lg border bg-card p-4">
            <h2 className="font-semibold text-sm mb-1">{t('dashboard.slaCompliance', 'SLA Compliance')}</h2>
            <p className={`text-sm ${metrics.slaCompliance?.slaStatus === 'compliant' ? 'text-emerald-600' : 'text-red-600'}`}>
              {metrics.slaCompliance?.slaStatus === 'compliant' ? t('dashboard.compliant', 'Compliant') : t('dashboard.violated', 'Violated')}
              {' — '}{metrics.slaCompliance?.overdueCount ?? 0} {t('reports.overdueCases', 'overdue case(s)')}
            </p>
          </div>
        </TabsContent>

        <TabsContent value="programs">
          {metrics.byProgram?.length ? (
            <DataTable columns={byProgramCols} data={metrics.byProgram} rowCount={metrics.byProgram.length}
              pagination={pagination} onPaginationChange={setPagination} sorting={sorting} onSortingChange={setSorting} />
          ) : <EmptyHint label={t('reports.noInterventionsPeriod', 'No interventions delivered in this period.')} />}
        </TabsContent>

        <TabsContent value="demographics" className="space-y-4">
          {metrics.byAgeBracket?.length || metrics.byGender?.length ? (
            <div className="grid lg:grid-cols-2 gap-4">
              {(['bracket', 'gender', 'barangay', 'category'] as const).map(dim => {
                const data = metrics[`by${dim === 'bracket' ? 'AgeBracket' : dim === 'category' ? 'Category' : dim === 'barangay' ? 'Barangay' : 'Gender'}`] || [];
                const title = dim === 'bracket' ? t('reports.byAgeBracket', 'Age Bracket')
                  : dim === 'gender' ? t('reports.byGender', 'Gender')
                  : dim === 'barangay' ? t('reports.byBarangay', 'Barangay')
                  : t('reports.byCategory', 'Client Category');
                return (
                  <div key={dim} className="rounded-lg border bg-card p-4">
                    <h2 className="font-semibold text-sm mb-3">{title}</h2>
                    {data.length ? (
                      <DataTable columns={simpleCountCols(dim, title)} data={data} rowCount={data.length}
                        pagination={pagination} onPaginationChange={setPagination} sorting={sorting} onSortingChange={setSorting} />
                    ) : <EmptyHint label={t('reports.noBeneficiariesPeriod', 'No beneficiaries served in this period.')} />}
                  </div>
                );
              })}
            </div>
          ) : <EmptyHint label={t('reports.noBeneficiariesPeriod', 'No beneficiaries served in this period.')} />}
        </TabsContent>

        <TabsContent value="funds">
          {metrics.byFundSource?.length ? (
            <DataTable columns={fundSourceCols} data={metrics.byFundSource} rowCount={metrics.byFundSource.length}
              pagination={pagination} onPaginationChange={setPagination} sorting={sorting} onSortingChange={setSorting} />
          ) : <EmptyHint label={t('reports.noFundsPeriod', 'No fund utilization in this period.')} />}
        </TabsContent>

        <TabsContent value="referrals">
          {metrics.referrals?.length ? (
            <DataTable columns={referralCols} data={metrics.referrals} rowCount={metrics.referrals.length}
              pagination={pagination} onPaginationChange={setPagination} sorting={sorting} onSortingChange={setSorting} />
          ) : <EmptyHint label={t('reports.noReferralsPeriod', 'No inter-agency referrals in this period.')} />}
        </TabsContent>

        <TabsContent value="trends">
          <DataTable columns={trendCols} data={metrics.trends || []} rowCount={(metrics.trends || []).length}
            pagination={pagination} onPaginationChange={setPagination} sorting={sorting} onSortingChange={setSorting} />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}