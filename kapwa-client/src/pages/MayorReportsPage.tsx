import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp, Users, DollarSign, Clock, CheckCircle, AlertTriangle, Download,
  FileBarChart2, LayoutGrid, UserRound, Landmark, Send, CalendarRange,
} from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DataTable } from '@/components/data-table';
import type { ColumnDef, PaginationState, SortingState } from '@tanstack/react-table';
import { queryKeys } from '../lib/query-keys';
import { downloadMonthlyFunds } from '../lib/api';
import { DataTableColumnHeader } from '@/components/data-table/DataTableColumnHeader';

const fmtPeso = (n: number | string | undefined | null) =>
  `₱${Number(n || 0).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;

const SORTABLE_COLUMN = (key: string, label: string): ColumnDef<any> => ({
  accessorKey: key,
  header: ({ column }) => <DataTableColumnHeader column={column} title={label} />,
  cell: ({ getValue }) => <span className="text-sm">{String(getValue() ?? '')}</span>,
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

interface BreakdownRow {
  program?: string; beneficiaries?: string | number; interventions?: string | number;
  amount?: string | number; fund_source?: string; gender?: string; bracket?: string;
  barangay?: string; category?: string; agency?: string; total?: string | number;
  referred?: string | number; accepted?: string | number; declined?: string | number;
  completed?: string | number; month?: string; casesCreated?: string | number;
}

export function MayorReportsPage() {
  const { t } = useTranslation();
  const { data: metrics, isLoading: loading } = useSWR(queryKeys.dashboard.mayorReports());
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

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
      <div className="no-print flex items-center gap-2 mb-4">
        <Button size="sm" onClick={handleExportFundUtilization} disabled={exporting}>
          <Download size={14} className="mr-1" /> {exporting ? t('dashboard.generating', 'Generating...') : t('dashboard.exportFundUtilization', 'Export Fund Utilization')}
        </Button>
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
            <DataTable
              columns={statusCols}
              data={metrics.caseStatusDistribution || []}
              rowCount={(metrics.caseStatusDistribution || []).length}
              pagination={pagination} onPaginationChange={setPagination}
              sorting={sorting} onSortingChange={setSorting}
            />
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
          <DataTable
            columns={byProgramCols}
            data={metrics.byProgram || []}
            rowCount={(metrics.byProgram || []).length}
            pagination={pagination} onPaginationChange={setPagination}
            sorting={sorting} onSortingChange={setSorting}
          />
        </TabsContent>

        <TabsContent value="demographics" className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-lg border bg-card p-4">
              <h2 className="font-semibold text-sm mb-3">{t('reports.byAgeBracket', 'Age Bracket')}</h2>
              <DataTable columns={simpleCountCols('bracket', t('reports.ageBracket', 'Age Bracket'))} data={metrics.byAgeBracket || []}
                rowCount={(metrics.byAgeBracket || []).length} pagination={pagination} onPaginationChange={setPagination}
                sorting={sorting} onSortingChange={setSorting} />
            </div>
            <div className="rounded-lg border bg-card p-4">
              <h2 className="font-semibold text-sm mb-3">{t('reports.byGender', 'Gender')}</h2>
              <DataTable columns={simpleCountCols('gender', t('reports.gender', 'Gender'))} data={metrics.byGender || []}
                rowCount={(metrics.byGender || []).length} pagination={pagination} onPaginationChange={setPagination}
                sorting={sorting} onSortingChange={setSorting} />
            </div>
            <div className="rounded-lg border bg-card p-4">
              <h2 className="font-semibold text-sm mb-3">{t('reports.byBarangay', 'Barangay')}</h2>
              <DataTable columns={simpleCountCols('barangay', t('reports.barangay', 'Barangay'))} data={metrics.byBarangay || []}
                rowCount={(metrics.byBarangay || []).length} pagination={pagination} onPaginationChange={setPagination}
                sorting={sorting} onSortingChange={setSorting} />
            </div>
            <div className="rounded-lg border bg-card p-4">
              <h2 className="font-semibold text-sm mb-3">{t('reports.byCategory', 'Client Category')}</h2>
              <DataTable columns={simpleCountCols('category', t('reports.category', 'Category'))} data={metrics.byCategory || []}
                rowCount={(metrics.byCategory || []).length} pagination={pagination} onPaginationChange={setPagination}
                sorting={sorting} onSortingChange={setSorting} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="funds">
          <DataTable columns={fundSourceCols} data={metrics.byFundSource || []}
            rowCount={(metrics.byFundSource || []).length} pagination={pagination} onPaginationChange={setPagination}
            sorting={sorting} onSortingChange={setSorting} />
        </TabsContent>

        <TabsContent value="referrals">
          <DataTable columns={referralCols} data={metrics.referrals || []}
            rowCount={(metrics.referrals || []).length} pagination={pagination} onPaginationChange={setPagination}
            sorting={sorting} onSortingChange={setSorting} />
        </TabsContent>

        <TabsContent value="trends">
          <DataTable columns={trendCols} data={metrics.trends || []}
            rowCount={(metrics.trends || []).length} pagination={pagination} onPaginationChange={setPagination}
            sorting={sorting} onSortingChange={setSorting} />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}