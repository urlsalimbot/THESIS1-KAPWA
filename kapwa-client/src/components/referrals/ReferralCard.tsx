import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
import { InterAgencyReferral, StatusTimeline } from './referral-utils';
import { ReferralActions } from './ReferralActions';
import { useTranslation } from 'react-i18next';
import { referralStatusLabel } from '@/i18n/display';

export function ReferralCard({
  referral,
  myAgencyId,
  onTransition,
  disabled = false,
}: {
  referral: InterAgencyReferral;
  myAgencyId?: string;
  onTransition: (id: string, action: string, body?: Record<string, string>) => Promise<void>;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const personName = referral.person
    ? `${referral.person.firstName} ${referral.person.surname}`.trim()
    : t('referrals.person', 'Person');

  return (
    <div className="rounded-lg bg-card p-4 shadow-sm border border-border space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold truncate">{personName}</p>
          <p className="text-xs text-muted-foreground truncate">
            {referral.fromAgency?.name || referral.fromAgencyId} →{' '}
            {referral.toAgency?.name || referral.toAgencyId}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {referral.status !== 'declined' && <StatusTimeline status={referral.status} />}
          <Badge variant={referral.status === 'declined' ? 'destructive' : 'default'}>
            {referralStatusLabel(t, referral.status)}
          </Badge>
          <Button
            size="sm"
            variant="ghost"
            aria-label={t('referrals.viewDetailsAria', 'View details for {{name}}', { name: personName })}
            onClick={() => navigate(`/agency/referrals/${referral.id}`, { state: { from: '/agency/referrals' } })}
          >
            <Eye size={16} />
          </Button>
        </div>
      </div>
      <p className="text-sm">{referral.reason}</p>
      <p className="text-xs text-muted-foreground">
        {t('referrals.basis', 'Basis: {{code}}', { code: referral.legalBasisCode })} · {new Date(referral.createdAt).toLocaleDateString()}
      </p>
      {referral.notes && <p className="text-xs text-muted-foreground">{t('referrals.notesLabel', 'Notes: {{notes}}', { notes: referral.notes })}</p>}
      {referral.outcome && <p className="text-xs text-muted-foreground">{t('referrals.outcomeLabel', 'Outcome: {{outcome}}', { outcome: referral.outcome })}</p>}
      {referral.declinedReason && (
        <p className="text-xs text-destructive">{t('referrals.declinedLabel', 'Declined: {{reason}}', { reason: referral.declinedReason })}</p>
      )}
      <ReferralActions referral={referral} myAgencyId={myAgencyId} onTransition={onTransition} disabled={disabled} />
    </div>
  );
}
