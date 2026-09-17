import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageShell } from '@/components/PageShell';
import { FourPsComplianceSection } from '@/components/case-view/FourPsComplianceSection';

export function FourPsCompliancePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const { t } = useTranslation();

  return (
    <PageShell
      title={t('fourps.title', '4Ps Compliance Monitoring')}
      description={t('fourps.description', 'Per-member conditionality tracking')}
    >
      {caseId ? <FourPsComplianceSection caseId={caseId} /> : null}
    </PageShell>
  );
}
