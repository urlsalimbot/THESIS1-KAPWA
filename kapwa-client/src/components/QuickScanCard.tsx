import { useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface AccessCardSummaryPerson {
  id: string;
  firstName: string;
  surname: string;
}

interface AccessCardSummary {
  cardCode: string;
  person: AccessCardSummaryPerson | null;
  servicesRendered: unknown[];
  servicesFromOtherAgencies: unknown[];
  referralHistory: unknown[];
  sharingConsentActive: boolean;
}

interface QuickScanCardProps {
  onLogged?: () => void;
}

export function QuickScanCard({ onLogged }: QuickScanCardProps) {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<AccessCardSummary | null>(null);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  async function verify() {
    if (verifying) return;
    setError('');
    setResult(null);
    if (!code.trim()) return;
    setVerifying(true);
    try {
      const data = await api.get<AccessCardSummary>(`/access-cards/${code.trim()}/summary`);
      setResult(data);
    } catch {
      setError('Card not found. Check the code and try again.');
    } finally {
      setVerifying(false);
    }
  }

  const personName = result?.person ? `${result.person.firstName} ${result.person.surname}` : '';

  return (
    <Card>
      <CardHeader><CardTitle>Quick Scan</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Input
          aria-label="Access card code"
          placeholder="NORZ-AC-2026-XXXX"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          onKeyDown={e => { if (e.key === 'Enter') verify(); }}
        />
        <Button onClick={verify} disabled={!code.trim() || verifying}>Verify Card</Button>
        {result && <p className="text-sm text-green-700">{personName || 'Card valid'}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {result && (
          <Button variant="outline" size="sm" onClick={() => { setCode(''); setResult(null); onLogged?.(); }}>
            Next Card
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
