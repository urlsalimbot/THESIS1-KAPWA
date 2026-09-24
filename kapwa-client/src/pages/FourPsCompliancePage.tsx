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
              <header className="flex flex-wrap items-center gap-2 px-4 py-3">
                <Users size={16} className="text-primary" aria-hidden="true" />
                <h2 className="text-sm font-semibold">{t('fourps.householdMembers', 'Household Members')}</h2>
                <span className="ml-auto text-xs text-muted-foreground">
                  {t('fourps.memberCount', '{{count}} member(s)', { count: members.length })}
                </span>
              </header>
              <p className="border-t px-4 py-2 text-xs text-muted-foreground">
                {t(
                  'fourps.conditionsHint',
                  'Conditions apply by age: health for children 0–5 and pregnant women, education for children 3–18, and FDS for the household head and spouse.',
                )}
              </p>
              <div className="space-y-2 px-4 py-3">
                {members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t('fourps.noMembers', 'No household members recorded for this case.')}
                  </p>
                ) : (
                  members.map((m) => {
                    // Which conditionalities this member is monitored against —
                    // mirrors the server's generation rule so the page explains
                    // why a member does or does not have items.
                    const age = m.age ?? 0;
                    const relationship = (m.relationship || '').toLowerCase();
                    const conditions: string[] = [];
                    if (age < 6) conditions.push(t('fourps.type.health_checkup', 'Health Check-up'));
                    if (age >= 3 && age <= 18) conditions.push(t('fourps.type.school_attendance', 'School Attendance'));
                    if (m.isPrimary || relationship === 'spouse') conditions.push(t('fourps.type.fds', 'Family Development Session'));
                    return (
                      <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-2 text-sm last:border-0">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{m.fullName}</p>
                          <p className="text-xs text-muted-foreground">
                            {[m.relationship, m.occupation, m.income != null ? `₱${Number(m.income).toLocaleString()}/mo` : null]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                          {m.age != null && <Badge variant="outline" className="text-[10px]">{t('fourps.age', '{{age}} y/o', { age: m.age })}</Badge>}
                          {m.isPrimary && <Badge variant="secondary" className="text-[10px]">{t('fourps.primary', 'Primary')}</Badge>}
                          {conditions.length > 0 ? (
                            conditions.map(condition => (
                              <Badge key={condition} variant="outline" className="border-primary/30 text-[10px] text-primary">
                                {condition}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-[10px] text-muted-foreground">
                              {t('fourps.noConditions', 'No conditions apply')}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </TabsContent>
        </Tabs>
      )}
    </PageShell>
  );
}
