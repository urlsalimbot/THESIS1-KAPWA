import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/EmptyState';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface ServiceRecord {
  id: string;
  type: string;
  date: string;
  amount: number;
  status: string;
}

interface ClaimantData {
  caseStatus: string;
  services: ServiceRecord[];
}

export function ClaimantWidgets() {
  const [data, setData] = useState<ClaimantData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, []);

  async function loadData(signal?: AbortSignal) {
    try {
      const token = localStorage.getItem('kapwa_token');
      const res = await fetch(`${API_URL}/beneficiaries/me/services`, {
        signal,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setData({
          caseStatus: d.caseStatus || 'No active case',
          services: d.services || [],
        });
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i}><CardContent className="p-4"><div className="h-12 bg-muted animate-pulse rounded" /></CardContent></Card>
        ))}
      </div>
    );
  }

  const statusVariant = data?.caseStatus === 'Disbursed' ? 'default'
    : data?.caseStatus === 'Approved' ? 'secondary'
    : 'outline';

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Access Card</p>
            <p className="text-sm font-medium text-primary">View your KAPWA Access Card</p>
          </div>
          <Link to="/my-access-card">
            <Button variant="default" size="sm">View Card</Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Case Status</p>
              <p className="text-lg font-semibold text-primary">
                {data?.caseStatus || 'No active case'}
              </p>
            </div>
            <Badge variant={statusVariant}>{data?.caseStatus || 'N/A'}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold text-sm text-primary">Service History</h3>
        </div>
        {!data || data.services.length === 0 ? (
          <CardContent><EmptyState variant="no-data" /></CardContent>
        ) : (
          <div className="divide-y">
            {data.services.map(s => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{s.type}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(s.date).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  {s.amount > 0 && (
                    <p className="text-sm font-semibold">₱{s.amount.toLocaleString()}</p>
                  )}
                  <span className={`text-xs ${s.status === 'completed' ? 'text-green-600' : 'text-amber-600'}`}>
                    {s.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
