import { useState } from 'react';
import useSWR from 'swr';
import { Shield, CheckCircle, XCircle, Download, Search, RefreshCw, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageShell } from '@/components/PageShell';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { queryKeys } from '../lib/query-keys';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';

export function AuditorPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'hash' | 'consent'>('hash');
  const [beneficiaryFilter, setBeneficiaryFilter] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });

  const { data: hashChain, isLoading: loading, mutate: revalidateHash } = useSWR<Record<string, { valid: boolean; brokenAt?: string }>>(
    queryKeys.audit.hashChains(),
  );
  const { data: consentLedger = [], isLoading: ledgerLoading, mutate: revalidateLedger } = useSWR<any[]>(
    queryKeys.audit.consentLedger(beneficiaryFilter || undefined),
  );

  const consentColumns: ColumnDef<any>[] = [
    { accessorKey: 'date', header: 'Date', cell: ({ row }) => <span>{new Date(row.original.grantedAt || row.original.createdAt).toLocaleDateString()}</span> },
    { accessorKey: 'channel', header: 'Channel' },
    { accessorKey: 'purpose', header: 'Purpose' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${row.original.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {row.original.status}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={() => navigate(`/cases/${row.original.caseId || row.original.id}`)} aria-label="View">
          <Eye size={14} className="mr-1" /> View
        </Button>
      ),
    },
  ];

  async function reVerify() {
    await revalidateHash();
  }

  async function loadLedger() {
    await revalidateLedger();
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Loading audit data...</div>;

  const allValid = hashChain && Object.values(hashChain).every((v: any) => v.valid);

  return (
    <PageShell
      title="Audit Logs"
      description="Hash-chain verified records and consent ledger"
    >

      <div className="flex gap-2 mb-4">
        <button onClick={() => setActiveTab('hash')} className={`px-3 py-1.5 text-xs rounded ${activeTab === 'hash' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}>Audit Logs</button>
        <button onClick={() => setActiveTab('consent')} className={`px-3 py-1.5 text-xs rounded ${activeTab === 'consent' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}>Consent Ledger</button>
      </div>

      {activeTab === 'hash' && (
        <div>
          <div className={`rounded-lg p-4 mb-4 flex items-center gap-3 ${allValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            {allValid ? <CheckCircle className="text-green-600" size={24} /> : <XCircle className="text-red-600" size={24} />}
            <div>
              <p className={`font-semibold ${allValid ? 'text-green-800' : 'text-red-800'}`}>
                {allValid ? 'All chains verified — integrity confirmed' : 'Chain integrity check failed — see details below'}
              </p>
              <p className="text-xs text-gray-500">Tables checked: interventions, cases, beneficiaries, consent_ledger</p>
            </div>
          </div>

          <div className="no-print flex gap-2 mb-4">
            <button onClick={reVerify} className="flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs text-white hover:bg-primary-dark">
              <RefreshCw size={14} /> Verify All Chains
            </button>
            <span className="flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs text-gray-600">
              <Download size={14} /> Export
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
                      {status.valid ? 'Valid' : `Broken at: ${status.brokenAt || 'unknown'}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
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
                placeholder="Filter by Beneficiary ID"
                className="w-full pl-8 pr-3 py-1.5 border rounded text-xs"
              />
            </div>
            <button onClick={loadLedger} disabled={ledgerLoading} className="px-3 py-1.5 bg-primary text-white rounded text-xs hover:bg-primary-dark disabled:opacity-50">
              {ledgerLoading ? 'Loading...' : 'Filter'}
            </button>
          </div>

          {consentLedger.length === 0 && !ledgerLoading ? (
            <div className="text-center py-8 text-sm text-muted-foreground">No consent records found</div>
          ) : ledgerLoading ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Loading...</div>
          ) : (
            <DataTable
              columns={consentColumns}
              data={consentLedger}
              rowCount={consentLedger.length}
              pagination={pagination}
              onPaginationChange={setPagination}
              sorting={[]}
            />
          )}
        </div>
      )}
    </PageShell>
  );
}
