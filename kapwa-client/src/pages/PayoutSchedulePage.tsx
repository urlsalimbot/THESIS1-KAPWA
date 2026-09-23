import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageShell } from '@/components/PageShell';
import { FourPsPayoutsSection } from '@/components/case-view/FourPsPayoutsSection';

export function PayoutSchedulePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const { t } = useTranslation();

  return (
    <PageShell
      title={t('payouts.title', '4Ps Payout Schedule')}
      description={t('payouts.description', 'Track DSWD payout schedules and beneficiary notifications')}
    >
      {caseId ? <FourPsPayoutsSection caseId={caseId} /> : null}
    </PageShell>
  );
}
