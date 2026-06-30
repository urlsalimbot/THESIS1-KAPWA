import { useState, useEffect } from 'react';
import { Shield, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { verifyHashChains } from '@/lib/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export function AuditorWidgets() {
  const [hashChain, setHashChain] = useState<Record<string, { valid: boolean; brokenAt?: string }> | null>(null);
  const [consentCount, setConsentCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const token = localStorage.getItem('kapwa_token');
      const [hashRes, ledgerRes] = await Promise.all([
        fetch(`${API_URL}/audit/verify-all`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/audit/consent-ledger`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (hashRes.ok) setHashChain(await hashRes.json());
      if (ledgerRes.ok) {
        const ledger = await ledgerRes.json();
        setConsentCount(Array.isArray(ledger) ? ledger.length : 0);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function handleReVerify() {
    setVerifying(true);
    try {
      const data = await verifyHashChains();
      setHashChain(data);
    } catch {
      // silent
    } finally {
      setVerifying(false);
    }
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
              <p className="text-lg font-semibold">{consentCount ?? '—'} records</p>
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
