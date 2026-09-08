import useSWR from 'swr';
import { Shield, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { queryKeys } from '@/lib/query-keys';
import { useTranslation } from 'react-i18next';

export function AuditorWidgets() {
  const { t } = useTranslation();
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
      <Card className={allValid ? 'borderemerald-200' : 'border-destructive/20'}>
        <CardContent className={`p-4 ${allValid ? 'bgemerald-50' : 'bg-destructive/10'}`}>
          <div className="flex items-center gap-3">
            {allValid ? (
              <CheckCircle className="textemerald-600 shrink-0" size={24} />
            ) : (
              <XCircle className="text-destructive shrink-0" size={24} />
            )}
            <div className="flex-1">
              <p className={`font-semibold text-sm ${allValid ? 'textemerald-800' : 'text-destructive'}`}>
                {allValid ? t('dashboard.chainsVerified', 'All chains verified — integrity confirmed') : t('dashboard.chainCheckFailed', 'Chain integrity check failed')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('dashboard.chainsTables', 'Tables: interventions, cases, beneficiaries, consent_ledger')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {hashChain && (
        <Card>
          <div className="border-b px-4 py-3">
            <h3 className="font-semibold text-sm text-primary">{t('dashboard.hashChainStatus', 'Hash-Chain Status')}</h3>
          </div>
          <div className="divide-y">
            {Object.entries(hashChain).map(([table, status]) => (
              <div key={table} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  {status.valid ? (
                    <CheckCircle size={16} className="textemerald-600" />
                  ) : (
                    <XCircle size={16} className="text-destructive" />
                  )}
                  <span className="text-sm font-medium capitalize">
                    {table.replace(/([A-Z])/g, ' $1')}
                  </span>
                </div>
                <span className={`text-xs ${status.valid ? 'textemerald-600' : 'text-destructive'}`}>
                  {status.valid ? t('dashboard.valid', 'Valid') : t('dashboard.brokenAt', 'Broken at: {{date}}', { date: status.brokenAt || t('dashboard.unknown', 'unknown') })}
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
              <p className="text-xs text-muted-foreground">{t('dashboard.consentLedger', 'Consent Ledger')}</p>
              <p className="text-lg font-semibold">{t('dashboard.records', '{{count}} records', { count: consentCount })}</p>
            </div>
            <Shield className="text-muted-foreground" size={20} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleReVerify} disabled={verifying} variant="outline" size="sm">
        <RefreshCw size={14} className={`mr-1.5 ${verifying ? 'animate-spin' : ''}`} />
        {verifying ? t('dashboard.verifying', 'Verifying...') : t('dashboard.reverifyChains', 'Re-verify All Chains')}
      </Button>
    </div>
  );
}
