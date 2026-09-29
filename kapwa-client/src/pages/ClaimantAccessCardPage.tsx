import useSWR from 'swr';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CategoryBadge } from '@/components/cards/CategoryBadge';
import { formatDate } from '../lib/format';
import { IdCard } from 'lucide-react';

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

// No beneficiary or no issued card resolves as 200 `{ card: null }`.
type MyAccessCardResponse = MyAccessCard | { card: null };

export function ClaimantAccessCardPage() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useSWR<MyAccessCardResponse>(queryKeys.beneficiaries.myAccessCard());

  // `{ card: null }` is the server saying "no access card on record" — a
  // brand-new beneficiary has no card until the office issues one. Treat that
  // as an expected empty state rather than loading failure noise.
  const noCard = !!data && 'card' in data && data.card === null;
  const card: MyAccessCard | undefined = data && 'code' in data ? data : undefined;

  return (
    <PageShell title={t('claims.myAccessCard', 'My Access Card')} description={t('claims.cardDescription', 'Your service history on record with MSWDO')}>
      {isLoading && <p className="text-sm text-muted-foreground">{t('claims.loadingCard', 'Loading your access card…')}</p>}
      {noCard && (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <div className="rounded-full bg-muted/60 p-5 mb-3">
            <IdCard size={36} className="opacity-50" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-foreground">{t('claims.noAccessCard', "You don't have an access card yet")}</p>
          <p className="text-sm mt-1">{t('claims.noAccessCardHint', 'Visit the MSWDO office to get one.')}</p>
          <Link
            to="/my-dashboard"
            className="mt-4 text-sm text-primary underline underline-offset-2 hover:no-underline"
          >
            {t('claims.backToDashboard', 'Back to My Dashboard')}
          </Link>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{t('claims.cardLoadFailed', 'Could not load your access card.')}</p>}
      {card && (
        <Card>
          <CardHeader>
            <CardTitle className="font-mono text-lg">{card.code}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {card.beneficiary?.name ?? ''}
              {card.beneficiary?.barangay ? ` · ${card.beneficiary.barangay}` : ''}
            </p>
          </CardHeader>
          <CardContent>
            <h2 className="text-sm font-semibold mb-3">{t('claims.serviceHistory', 'Service History')}</h2>
            {(card.services?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">{t('claims.noServices', 'No services recorded yet.')}</p>
            )}
            <ul className="space-y-2">
              {(card.services ?? []).map((s, i) => (
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
