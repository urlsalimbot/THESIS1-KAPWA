import { useState, useEffect, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { Shield, CheckCircle, XCircle, Download, Search, RefreshCw, Eye, ListChecks } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageShell } from '@/components/PageShell';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { queryKeys } from '../lib/query-keys';
import { api } from '../lib/api';
import { DataTableColumnHeader } from '@/components/data-table/DataTableColumnHeader';
import type { ColumnDef, PaginationState, Updater } from '@tanstack/react-table';

interface AuditRow {
  id: string; action: string; reference_id: string | null; user_id: string | null;
  user_email?: string | null; user_name?: string | null; details?: Record<string, unknown> | null;
  created_at: string;
}

export function AuditorPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const urlLimit = parseInt(searchParams.get('limit') || '10', 10);
  const [activeTab, setActiveTab] = useState<'hash' | 'consent' | 'trail'>('hash');
  const [beneficiaryFilter, setBeneficiaryFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const updateURL = useCallback((overrides: Record<string, string | undefined>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(overrides)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const pagination: PaginationState = { pageIndex: urlPage - 1, pageSize: urlLimit };

  const onPaginationChange = useCallback(
    (updater: Updater<PaginationState>) => {
      const next = typeof updater === 'function' ? updater(pagination) : updater;
      updateURL({ page: String(next.pageIndex + 1), limit: String(next.pageSize) });
    },
    [pagination, updateURL],
  );

  const { data: hashChain, isLoading: loading, mutate: revalidateHash } = useSWR<Record<string, { valid: boolean; brokenAt?: string }>>(
    queryKeys.audit.hashChains(),
  );
  const { data: consentLedger = [], isLoading: ledgerLoading, mutate: revalidateLedger } = useSWR<any[]>(
    queryKeys.audit.consentLedger(beneficiaryFilter || undefined),
  );
  const { data: auditTrail = [], isLoading: trailLoading, mutate: revalidateTrail } = useSWR<AuditRow[]>(
    queryKeys.audit.logs(actionFilter || undefined),
    ([, , action]: readonly string[]) => {
      const params = new URLSearchParams();
      if (action !== 'all') params.set('table', action);
      const qs = params.toString();
      return api.get<any[]>(`/audit/logs${qs ? `?${qs}` : ''}`);
    },
  );

  const consentColumns: ColumnDef<any>[] = [
    { accessorKey: 'date', header: t('dashboard.date', 'Date'), cell: ({ row }) => <span>{new Date(row.original.grantedAt || row.original.createdAt).toLocaleDateString()}</span> },
    { accessorKey: 'channel', header: t('dashboard.channel', 'Channel') },
    { accessorKey: 'purpose', header: t('dashboard.purpose', 'Purpose') },
    {
      accessorKey: 'status',
      header: t('dashboard.statusLabel', 'Status'),
      cell: ({ row }) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${row.original.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {row.original.status}
        </span>
      ),
    },
    {
      id: 'actions',
      header: t('dashboard.actions', 'Actions'),
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={() => navigate(`/cases/${row.original.caseId || row.original.id}`)} aria-label={t('dashboard.view', 'View')}>
          <Eye size={14} className="mr-1" /> {t('dashboard.view', 'View')}
        </Button>
      ),
    },
  ];

  const ACTION_OPTIONS = ['beneficiary', 'case', 'irf', 'access_card', 'announcement', 'user'];

  const trailColumns: ColumnDef<AuditRow>[] = useMemo(() => [
    { accessorKey: 'created_at', header: ({ column }) => <DataTableColumnHeader column={column} title={t('audit.dateTime', 'Date / Time')} />, cell: ({ row }) => <span className="text-xs tabular-nums">{new Date(row.original.created_at).toLocaleString()}</span> },
    { accessorKey: 'action', header: ({ column }) => <DataTableColumnHeader column={column} title={t('audit.action', 'Action')} />, cell: ({ row }) => <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium font-mono">{row.original.action}</span> },
    { accessorKey: 'user', header: t('audit.user', 'User'), cell: ({ row }) => row.original.user_name ? <span className="text-sm">{row.original.user_name}</span> : <span className="text-xs text-muted-foreground italic">system</span> },
    { accessorKey: 'user_email', header: t('audit.email', 'Email'), cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.user_email || '—'}</span> },
    { accessorKey: 'reference_id', header: t('audit.record', 'Record'), cell: ({ row }) => row.original.reference_id ? <span className="text-xs font-mono">{row.original.reference_id.slice(0, 12)}</span> : <span className="text-xs text-muted-foreground">—</span> },
    { accessorKey: 'details', header: t('audit.details', 'Details'), cell: ({ row }) => {
      const d = row.original.details;
      if (!d) return <span className="text-xs text-muted-foreground">—</span>;
      const s = JSON.stringify(d);
      return <span className="text-xs text-muted-foreground" title={s}>{s.length > 60 ? `${s.slice(0, 60)}…` : s}</span>;
    } },
  ], [t]);

  async function reVerify() {
    await revalidateHash();
  }

  async function loadLedger() {
    await revalidateLedger();
  }

  if (loading) return <div className="p-8 text-center text-gray-500">{t('dashboard.loadingAudit', 'Loading audit data...')}</div>;

  const allValid = hashChain && Object.values(hashChain).every((v: any) => v.valid);

  return (
    <PageShell
      title={t('dashboard.auditLogs', 'Audit Logs')}
      description={t('dashboard.auditDescription', 'Hash-chain verified records and consent ledger')}
    >

      <div className="flex gap-2 mb-4">
        <button onClick={() => setActiveTab('hash')} className={`px-3 py-1.5 text-xs rounded ${activeTab === 'hash' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}>{t('dashboard.auditLogs', 'Audit Logs')}</button>
        <button onClick={() => setActiveTab('trail')} className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded ${activeTab === 'trail' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}><ListChecks size={13} /> {t('audit.trail', 'Audit Trail')}</button>
        <button onClick={() => setActiveTab('consent')} className={`px-3 py-1.5 text-xs rounded ${activeTab === 'consent' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}>{t('dashboard.consentLedger', 'Consent Ledger')}</button>
      </div>

      {activeTab === 'hash' && (
        <div>
          <div className={`rounded-lg p-4 mb-4 flex items-center gap-3 ${allValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            {allValid ? <CheckCircle className="text-green-600" size={24} /> : <XCircle className="text-red-600" size={24} />}
            <div>
              <p className={`font-semibold ${allValid ? 'text-green-800' : 'text-red-800'}`}>
                {allValid ? t('dashboard.chainsVerified', 'All chains verified — integrity confirmed') : t('dashboard.chainsFailed', 'Chain integrity check failed — see details below')}
              </p>
              <p className="text-xs text-gray-500">{t('dashboard.tablesChecked', 'Tables checked: interventions, cases, beneficiaries, consent_ledger')}</p>
            </div>
          </div>

          <div className="no-print flex gap-2 mb-4">
            <button onClick={reVerify} className="flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs text-white hover:bg-primary-dark">
              <RefreshCw size={14} /> {t('dashboard.verifyAllChains', 'Verify All Chains')}
            </button>
            <span className="flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs text-gray-600">
              <Download size={14} /> {t('dashboard.export', 'Export')}
            </span>
          </div>

          {hashChain && (
            <div className="rounded-lg border bg-white">
              <div className="divide-y">
                {Object.entries(hashChain).map(([table, status]: [string, any]) => (
                  <div key={table} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2">
                      {status.valid ? <CheckCircle size={16} className="text-green-600" /> : <XCircle size={16} className="text-red-600" />}
                      <span className="text-sm font-medium capitalize">{table.replace(/([A-Z])/g, ' $1')}</span>
                    </div>
                    <span className={`text-xs ${status.valid ? 'text-green-600' : 'text-red-600'}`}>
                      {status.valid ? t('dashboard.valid', 'Valid') : t('dashboard.brokenAt', 'Broken at: {{where}}', { where: status.brokenAt || 'unknown' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'trail' && (
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative">
              <ListChecks className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <select
                value={actionFilter}
                onChange={e => setActionFilter(e.target.value)}
                aria-label={t('audit.filterByAction', 'Filter by action type')}
                className="pl-8 pr-3 py-1.5 border rounded text-xs bg-white"
              >
                <option value="">{t('audit.allActions', 'All actions')}</option>
                {ACTION_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <button onClick={() => revalidateTrail()} disabled={trailLoading} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded text-xs hover:bg-primary-dark disabled:opacity-50">
              <RefreshCw size={13} /> {trailLoading ? t('dashboard.loading', 'Loading...') : t('audit.refresh', 'Refresh')}
            </button>
            <span className="ml-auto text-xs text-muted-foreground">{auditTrail.length} {t('audit.entries', 'entries')}</span>
          </div>

          {auditTrail.length === 0 && !trailLoading ? (
            <div className="text-center py-8 text-sm text-muted-foreground">{t('audit.noEntries', 'No audit entries found')}</div>
          ) : trailLoading ? (
            <div className="text-center py-8 text-sm text-muted-foreground">{t('dashboard.loading', 'Loading...')}</div>
          ) : (
            <DataTable
              columns={trailColumns}
              data={auditTrail}
              rowCount={auditTrail.length}
              pagination={pagination}
              onPaginationChange={onPaginationChange}
              sorting={[]}
            />
          )}
        </div>
      )}

      {activeTab === 'consent' && (
        <div>
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                value={beneficiaryFilter}
                onChange={e => setBeneficiaryFilter(e.target.value)}
                placeholder={t('dashboard.filterByBeneficiaryId', 'Filter by Beneficiary ID')}
                className="w-full pl-8 pr-3 py-1.5 border rounded text-xs"
              />
            </div>
            <button onClick={loadLedger} disabled={ledgerLoading} className="px-3 py-1.5 bg-primary text-white rounded text-xs hover:bg-primary-dark disabled:opacity-50">
              {ledgerLoading ? t('dashboard.loading', 'Loading...') : t('dashboard.filter', 'Filter')}
            </button>
          </div>

          {consentLedger.length === 0 && !ledgerLoading ? (
            <div className="text-center py-8 text-sm text-muted-foreground">{t('dashboard.noConsentRecords', 'No consent records found')}</div>
          ) : ledgerLoading ? (
            <div className="text-center py-8 text-sm text-muted-foreground">{t('dashboard.loading', 'Loading...')}</div>
          ) : (
            <DataTable
              columns={consentColumns}
              data={consentLedger}
              rowCount={consentLedger.length}
              pagination={pagination}
              onPaginationChange={onPaginationChange}
              sorting={[]}
            />
          )}
        </div>
      )}
    </PageShell>
  );
}
