import { useState } from 'react';
import useSWR from 'swr';
import { Shield, CheckCircle, XCircle, Download, Search, RefreshCw } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { queryKeys } from '../lib/query-keys';

export function AuditorPage() {
  const [activeTab, setActiveTab] = useState<'hash' | 'consent'>('hash');
  const [beneficiaryFilter, setBeneficiaryFilter] = useState('');

  const { data: hashChain, isLoading: loading, mutate: revalidateHash } = useSWR<Record<string, { valid: boolean; brokenAt?: string }>>(
    queryKeys.audit.hashChains(),
  );
  const { data: consentLedger = [], isLoading: ledgerLoading, mutate: revalidateLedger } = useSWR<any[]>(
    queryKeys.audit.consentLedger(beneficiaryFilter || undefined),
  );

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

          <div className="rounded-lg border bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-gray-50 text-gray-500">
                    <th className="text-left px-4 py-2">Date</th>
                    <th className="text-left px-4 py-2">Channel</th>
                    <th className="text-left px-4 py-2">Purpose</th>
                    <th className="text-left px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {consentLedger.length === 0 ? (
                    <tr><td colSpan={4} className="text-center px-4 py-8 text-gray-400">No consent records found</td></tr>
                  ) : (
                    consentLedger.map((r: any) => (
                      <tr key={r.id} className="border-b border-gray-100">
                        <td className="px-4 py-2">{new Date(r.grantedAt || r.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-2">{r.channel}</td>
                        <td className="px-4 py-2">{r.purpose}</td>
                        <td className="px-4 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            r.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>{r.status}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
