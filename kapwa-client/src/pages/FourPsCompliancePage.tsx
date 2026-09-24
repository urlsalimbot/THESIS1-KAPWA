import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { CreditCard, ExternalLink, Users } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { FourPsComplianceSection } from '@/components/case-view/FourPsComplianceSection';
import { FourPsPayoutsSection } from '@/components/case-view/FourPsPayoutsSection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { queryKeys } from '@/lib/query-keys';
import { setBreadcrumbLabel } from '@/lib/breadcrumbs';

interface HouseholdMember {
  id: string;
  fullName: string;
  relationship: string;
  age: number | null;
  occupation: string | null;
  income: number | null;
  status: string | null;
  isPrimary: boolean;
}

// Everything needed to operate and monitor a Pantawid Pamilyang Pilipino Program
// household in one place:
//   Compliance — the 12-month conditionality set (health check-ups, school
//                attendance, Family Development Sessions) marked per member;
//   Payouts    — the DSWD payout cycles, with notify / completed / missed /
//                cancelled, each logged to the household access card;
//   Household  — the members the conditions apply to, and the card the payouts
//                and check-offs are accounted against.
export function FourPsCompliancePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const { t } = useTranslation();
  const { data: caseData } = useSWR<any>(caseId ? queryKeys.cases.detail(caseId) : null);

  // Deep links to this route are not covered by the case view's registration.
  useEffect(() => {
    if (caseId && caseData?.controlNo) setBreadcrumbLabel(caseId, caseData.controlNo);
  }, [caseId, caseData]);

  const household = caseData?.beneficiary?.household;
  const members: HouseholdMember[] = household?.familyMembers ?? [];
  const cardCode: string | undefined = caseData?.beneficiary?.accessCardCode;
  const beneficiaryId: string | undefined = caseData?.beneficiary?.id;

  return (
    <PageShell
      title={t('fourps.title', '4Ps Program')}
      description={t('fourps.pageDescription', 'Compliance, payouts and household monitoring')}
      actions={beneficiaryId && cardCode ? (
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <a href={`/beneficiary/${beneficiaryId}/access-card`}>
            <CreditCard size={14} aria-hidden="true" />
            {cardCode}
            <ExternalLink size={12} aria-hidden="true" />
          </a>
        </Button>
      ) : undefined}
    >
      {!caseId ? null : (
        <Tabs defaultValue="compliance">
          <TabsList>
            <TabsTrigger value="compliance">{t('fourps.tabCompliance', 'Compliance')}</TabsTrigger>
            <TabsTrigger value="payouts">{t('fourps.tabPayouts', 'Payouts')}</TabsTrigger>
            <TabsTrigger value="household">{t('fourps.tabHousehold', 'Household')}</TabsTrigger>
          </TabsList>

          <TabsContent value="compliance">
            <FourPsComplianceSection caseId={caseId} />
          </TabsContent>

          <TabsContent value="payouts">
            <FourPsPayoutsSection caseId={caseId} />
          </TabsContent>

          <TabsContent value="household">
            <section className="rounded-lg border bg-card">
              <header className="flex items-center gap-2 px-4 py-3">
                <Users size={16} className="text-primary" aria-hidden="true" />
                <h2 className="text-sm font-semibold">{t('fourps.householdMembers', 'Household Members')}</h2>
                <span className="ml-auto text-xs text-muted-foreground">
                  {t('fourps.memberCount', '{{count}} member(s)', { count: members.length })}
                </span>
              </header>
              <div className="border-t px-4 py-3 space-y-2">
                {members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t('fourps.noMembers', 'No household members recorded for this case.')}
                  </p>
                ) : (
                  members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-3 text-sm border-b last:border-0 py-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{m.fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          {[m.relationship, m.occupation, m.income != null ? `₱${Number(m.income).toLocaleString()}/mo` : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {m.age != null && <Badge variant="outline" className="text-[10px]">{t('fourps.age', '{{age}} y/o', { age: m.age })}</Badge>}
                        {m.isPrimary && <Badge variant="secondary" className="text-[10px]">{t('fourps.primary', 'Primary')}</Badge>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </TabsContent>
        </Tabs>
      )}
    </PageShell>
  );
}
