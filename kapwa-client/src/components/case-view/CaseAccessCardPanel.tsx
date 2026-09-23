import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CreditCard, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

// The access card is the household's accounting vehicle (payouts, compliance
// check-offs, referrals). It is not a 4Ps-only surface, so the case view only
// links to it — logging happens where the service is recorded (4Ps payouts and
// compliance log automatically; other services log from the card page).
export function CaseAccessCardPanel({ beneficiaryId, cardCode }: { beneficiaryId: string; cardCode?: string }) {
  const { t } = useTranslation();
  if (!beneficiaryId || !cardCode) return null;

  return (
    <section className="rounded-lg border bg-card">
      <header className="flex items-center gap-2.5 px-4 py-3">
        <CreditCard size={18} className="shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="truncate font-heading text-sm font-semibold">
            {t('caseView.accessCard', 'Access Card')}
          </h3>
          <p className="truncate text-xs text-muted-foreground">{cardCode}</p>
        </div>
      </header>
      <Separator />
      <div className="px-4 py-3">
        <Button asChild variant="outline" size="sm" className="w-full justify-center gap-1.5">
          <Link to={`/beneficiary/${beneficiaryId}/access-card`}>
            {t('caseView.viewAccessCard', 'View Access Card')}
            <ExternalLink size={13} aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
