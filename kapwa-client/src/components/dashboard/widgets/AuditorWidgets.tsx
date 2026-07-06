import useSWR from 'swr';
import { Shield, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { queryKeys } from '@/lib/query-keys';

export function AuditorWidgets() {
  const { data: hashChain, isLoading: loading, isValidating: verifying, mutate: revalidateHash } = useSWR<
    Record<string, { valid: boolean; brokenAt?: string }>
  >(queryKeys.audit.hashChains());

  const { data: ledger } = useSWR<unknown[]>(queryKeys.audit.consentLedger());
  const consentCount = Array.isArray(ledger) ? ledger.length : 0;

  async function handleReVerify() {
    await revalidateHash();
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => (
          <Card key={i}><CardContent className="p-4"><div className="h-16 bg-muted animate-pulse rounded" /></CardContent></Card>
        ))}
      </div>
    );
  }

  const allValid = hashChain && Object.values(hashChain).every(v => v.valid);

  return (
    <div className="space-y-4">
      <Card className={allValid ? 'border-green-200' : 'border-red-200'}>
        <CardContent className={`p-4 ${allValid ? 'bg-green-50' : 'bg-red-50'}`}>
          <div className="flex items-center gap-3">
            {allValid ? (
              <CheckCircle className="text-green-600 shrink-0" size={24} />
            ) : (
              <XCircle className="text-red-600 shrink-0" size={24} />
            )}
            <div className="flex-1">
              <p className={`font-semibold text-sm ${allValid ? 'text-green-800' : 'text-red-800'}`}>
                {allValid ? 'All chains verified — integrity confirmed' : 'Chain integrity check failed'}
              </p>
              <p className="text-xs text-muted-foreground">
                Tables: interventions, cases, beneficiaries, consent_ledger
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {hashChain && (
        <Card>
          <div className="border-b px-4 py-3">
            <h3 className="font-semibold text-sm text-primary">Hash-Chain Status</h3>
          </div>
          <div className="divide-y">
            {Object.entries(hashChain).map(([table, status]) => (
              <div key={table} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  {status.valid ? (
                    <CheckCircle size={16} className="text-green-600" />
                  ) : (
                    <XCircle size={16} className="text-red-600" />
                  )}
                  <span className="text-sm font-medium capitalize">
                    {table.replace(/([A-Z])/g, ' $1')}
                  </span>
                </div>
                <span className={`text-xs ${status.valid ? 'text-green-600' : 'text-red-600'}`}>
                  {status.valid ? 'Valid' : `Broken at: ${status.brokenAt || 'unknown'}`}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Consent Ledger</p>
              <p className="text-lg font-semibold">{consentCount} records</p>
            </div>
            <Shield className="text-muted-foreground" size={20} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleReVerify} disabled={verifying} variant="outline" size="sm">
        <RefreshCw size={14} className={`mr-1.5 ${verifying ? 'animate-spin' : ''}`} />
        {verifying ? 'Verifying...' : 'Re-verify All Chains'}
      </Button>
    </div>
  );
}
