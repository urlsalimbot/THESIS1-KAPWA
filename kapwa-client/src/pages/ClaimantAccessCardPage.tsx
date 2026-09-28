import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CategoryBadge } from '@/components/cards/CategoryBadge';
import { formatDate } from '../lib/format';

interface MyAccessCard {
  code: string;
  beneficiary?: { name: string; barangay?: string };
  // The shape `BeneficiariesService.getAccessCard` returns, which is the only
  // thing that serves this route. It maps the raw columns itself, so the
  // snake_case spellings this used to also accept were never reachable.
  services?: {
    serviceRendered?: string;
    serviceDate?: string | null;
    cost?: number | null;
    category?: string;
  }[];
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
            <p className="text-sm text-muted-foreground">
              {data.beneficiary?.name ?? ''}
              {data.beneficiary?.barangay ? ` · ${data.beneficiary.barangay}` : ''}
            </p>
          </CardHeader>
          <CardContent>
            <h2 className="text-sm font-semibold mb-3">{t('claims.serviceHistory', 'Service History')}</h2>
            {(data.services?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">{t('claims.noServices', 'No services recorded yet.')}</p>
            )}
            <ul className="space-y-2">
              {(data.services ?? []).map((s, i) => (
                <li key={i} className="flex items-center justify-between text-sm border-b py-2 last:border-0">
                  <span>{s.serviceRendered}</span>
                  <span className="flex items-center gap-3 text-muted-foreground">
                    <CategoryBadge category={s.category} />
                    {s.cost != null && s.cost > 0 && <span className="font-semibold text-foreground">₱{s.cost.toLocaleString()}</span>}
                    <span className="text-xs">{formatDate(s.serviceDate)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
