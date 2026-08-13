import useSWR from 'swr';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/EmptyState';
import { queryKeys } from '@/lib/query-keys';
import { useTranslation } from 'react-i18next';
import { statusLabel } from '@/i18n/display';

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
  const { t } = useTranslation();
  const { data, isLoading: loading } = useSWR<{ caseStatus?: string; services?: ServiceRecord[] }>(
    queryKeys.beneficiaries.myServices(),
  );

  const mapped: ClaimantData | null = data
    ? {
        caseStatus: data.caseStatus || t('dashboard.noActiveCase', 'No active case'),
        services: data.services || [],
      }
    : null;

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i}><CardContent className="p-4"><div className="h-12 bg-muted animate-pulse rounded" /></CardContent></Card>
        ))}
      </div>
    );
  }

  const statusVariant = mapped?.caseStatus === 'Disbursed' ? 'default'
    : mapped?.caseStatus === 'Approved' ? 'secondary'
    : 'outline';

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{t('dashboard.accessCard', 'Access Card')}</p>
            <p className="text-sm font-medium text-primary">{t('dashboard.viewAccessCard', 'View your KAPWA Access Card')}</p>
          </div>
          <Link to="/my-access-card">
            <Button variant="default" size="sm">{t('dashboard.viewCard', 'View Card')}</Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{t('dashboard.caseStatus', 'Case Status')}</p>
              <p className="text-lg font-semibold text-primary">
                {mapped?.caseStatus || t('dashboard.noActiveCase', 'No active case')}
              </p>
            </div>
            <Badge variant={statusVariant}>{mapped?.caseStatus || t('dashboard.na', 'N/A')}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold text-sm text-primary">{t('dashboard.serviceHistory', 'Service History')}</h3>
        </div>
        {!mapped || mapped.services.length === 0 ? (
          <CardContent><EmptyState variant="no-data" /></CardContent>
        ) : (
          <div className="divide-y">
            {mapped.services.map(s => (
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
