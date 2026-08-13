import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MyAccessCard {
  code: string;
  beneficiary?: { name: string; barangay?: string };
  services?: { service_rendered?: string; serviceRendered?: string; service_date?: string; serviceDate?: string; cost?: number | null }[];
  remainingSlots?: number;
}

export function ClaimantAccessCardPage() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useSWR<MyAccessCard>(queryKeys.beneficiaries.myAccessCard());

  return (
    <PageShell title={t('claims.myAccessCard', 'My Access Card')} description={t('claims.cardDescription', 'Your service history on record with MSWDO')}>
      {isLoading && <p className="text-sm text-muted-foreground">{t('claims.loadingCard', 'Loading your access card…')}</p>}
      {error && <p className="text-sm text-destructive">{t('claims.cardLoadFailed', 'Could not load your access card.')}</p>}
      {data && (
        <Card>
          <CardHeader>
            <CardTitle className="font-mono text-lg">{data.code}</CardTitle>
          </CardHeader>
          <CardContent>
            {(data.services?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">{t('claims.noServices', 'No services recorded yet.')}</p>
            )}
            <ul className="space-y-2">
              {(data.services ?? []).map((s, i) => (
                <li key={i} className="flex justify-between text-sm border-b py-2">
                  <span>{s.service_rendered ?? s.serviceRendered}</span>
                  <span>{s.service_date ?? s.serviceDate}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
