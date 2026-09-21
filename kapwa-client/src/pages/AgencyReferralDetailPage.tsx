import { useLocation, useNavigate, useParams } from 'react-router-dom';
import useSWR, { useSWRConfig } from 'swr';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { useAuth } from '@/lib/auth-context';
import { PageShell } from '@/components/PageShell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, ExternalLink } from 'lucide-react';
import { InterAgencyReferral, StatusTimeline, referralIntakeState, referralFullName } from '@/components/referrals/referral-utils';
import { ReferralActions } from '@/components/referrals/ReferralActions';
import { referralStatusLabel } from '@/i18n/display';

export function AgencyReferralDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { mutate } = useSWRConfig();
  const myAgencyId = user?.agencyId;

  const backTo = (location.state as { from?: string } | null)?.from || '/agency/referrals';

  const { data, isLoading, error } = useSWR(
    id ? queryKeys.interAgencyReferrals.detail(id) : null,
    (key) => api.get<InterAgencyReferral>(key),
  );

  async function transition(transitionId: string, action: string, body?: Record<string, string>) {
    try {
      await api.patch(`/inter-agency-referrals/${transitionId}/${action}`, body);
      if (id) await mutate(queryKeys.interAgencyReferrals.detail(id));

      // Only MSWDO runs an intake. An external receiving agency (RHU, LTO...)
      // keeps the plain receive-and-refresh behaviour — and agency_staff cannot
      // open /intake at all, since that route is admin/social_worker only.
      if (action === 'receive' && data?.toAgency?.code === 'MSWDO' && data.personId) {
        navigate('/intake', { state: referralIntakeState('inter_agency', data) });
      }
    } catch (err: any) {
      toast.error(t('agency.transitionFailed', 'Could not update this referral'), { description: humanizeError(err) });
    }
  }

  if (isLoading) {
    return (
      <PageShell title={t('referrals.detailsTitle', 'Referral Details')} description="" backTo={{ label: t('referrals.backToReferrals', 'Back to Referrals'), onClick: () => navigate(backTo) }}>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin" size={32} />
        </div>
      </PageShell>
    );
  }

  if (error || !data) {
    return (
      <PageShell title={t('referrals.notFound', 'Referral not found')} description="" backTo={{ label: t('referrals.backToReferrals', 'Back to Referrals'), onClick: () => navigate(backTo) }}>
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <p className="text-sm">{t('referrals.notFoundBody', 'This referral may have been removed or you do not have access to it.')}</p>
        </div>
      </PageShell>
    );
  }

  const personName = referralFullName(data) || t('referrals.person', 'Person');

  // Mirrors the barangay side: a received referral with no case yet still needs
  // an intake. Inter-agency statuses have no 'accepted' state — 'received' is
  // the equivalent.
  const intakePending = data.status === 'received' && !data.caseId;

  return (
    <PageShell
      title={`${personName} — ${t('referrals.detailsTitle', 'Referral Details')}`}
      description={t('referrals.detailsDesc', 'Full information for this inter-agency referral.')}
      backTo={{ label: t('referrals.backToReferrals', 'Back to Referrals'), onClick: () => navigate(backTo) }}
    >
      <div className="max-w-3xl space-y-4">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-lg font-semibold font-heading">{personName}</h2>
                <p className="text-sm text-muted-foreground">
                  {t('referrals.fromAgency', 'From Agency')}: {data.fromAgency?.name || data.fromAgencyId} →{' '}
                  {t('referrals.toAgency', 'To Agency')}: {data.toAgency?.name || data.toAgencyId}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {data.status !== 'declined' && <StatusTimeline status={data.status} />}
                {intakePending && (
                  <Badge variant="secondary">{t('referral.intakePending', 'Intake pending')}</Badge>
                )}
                <Badge variant={data.status === 'declined' ? 'destructive' : 'default'}>
                  {referralStatusLabel(t, data.status)}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground font-medium">{t('referrals.reasonLabel', 'Reason')}</span>
                <p className="font-medium">{data.reason}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-medium">{t('referrals.legalBasis', 'Legal Basis')}</span>
                <p className="font-medium">{data.legalBasisCode}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-medium">{t('referral.date', 'Date')}</span>
                <p className="font-medium">{new Date(data.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-medium">{t('referrals.linkedCase', 'Linked Case')}</span>
                {data.caseId ? (
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => navigate(`/cases/${data.caseId}`)}>
                    {data.case?.controlNo || data.caseId} <ExternalLink size={12} className="ml-1" />
                  </Button>
                ) : (
                  <p className="font-medium text-muted-foreground">{t('referrals.noLinkedCase', 'No linked case')}</p>
                )}
              </div>
            </div>

            {data.notes && (
              <p className="text-sm text-muted-foreground">{t('referrals.notesLabel', 'Notes: {{notes}}', { notes: data.notes })}</p>
            )}
            {data.outcome && (
              <p className="text-sm text-muted-foreground">{t('referrals.outcomeLabel', 'Outcome: {{outcome}}', { outcome: data.outcome })}</p>
            )}
            {data.declinedReason && (
              <p className="text-sm text-destructive">{t('referrals.declinedLabel', 'Declined: {{reason}}', { reason: data.declinedReason })}</p>
            )}

            <div className="border-t pt-4">
              <ReferralActions referral={data} myAgencyId={myAgencyId} onTransition={transition} />
            </div>
          </CardContent>
        </Card>

        <Button variant="ghost" size="sm" onClick={() => navigate(backTo)}>
          <ArrowLeft size={14} className="mr-1" /> {t('referrals.backToReferrals', 'Back to Referrals')}
        </Button>
      </div>
    </PageShell>
  );
}