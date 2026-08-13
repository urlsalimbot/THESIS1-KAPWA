import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { InterAgencyReferral, StatusTimeline } from './referral-utils';
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
  const [outcome, setOutcome] = useState('');
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const isReceiver = referral.toAgencyId === myAgencyId;
  const canReceive = isReceiver && referral.status === 'referred';
  const canAction = isReceiver && referral.status === 'received';
  const canClose = isReceiver && referral.status === 'actioned';
  const canDecline = isReceiver && referral.status === 'referred';
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
      {canReceive && (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onTransition(referral.id, 'receive')} disabled={disabled}>
            {t('referrals.receive', 'Receive')}
          </Button>
          <AlertDialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" disabled={disabled}>
                {t('referrals.decline', 'Decline')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('referrals.declineTitle', 'Decline Referral?')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('referrals.declineDesc', 'This will decline the referral for this beneficiary. This action cannot be undone.')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('referrals.keepReferral', 'Keep Referral')}</AlertDialogCancel>
                <AlertDialogAction onClick={async () => {
                  await onTransition(referral.id, 'decline', { declinedReason: 'Unable to accommodate' });
                  setDeclineDialogOpen(false);
                }}>
                  {t('referrals.decline', 'Decline')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
      {canAction && (
        <Button size="sm" onClick={() => onTransition(referral.id, 'action')} disabled={disabled}>
          {t('referrals.markActioned', 'Mark Actioned')}
        </Button>
      )}
      {canClose && (
        <div className="flex gap-2 items-end">
          <input
            value={outcome}
            onChange={e => setOutcome(e.target.value)}
            placeholder={t('referrals.outcome', 'Outcome')}
            className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          />
          <AlertDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                disabled={disabled || !outcome.trim()}
              >
                {t('referrals.close', 'Close')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('referrals.closeTitle', 'Close Referral?')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('referrals.closeDesc', 'This will permanently close the referral for this beneficiary. This action cannot be undone.')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('referrals.keepOpen', 'Keep Open')}</AlertDialogCancel>
                <AlertDialogAction onClick={async () => {
                  await onTransition(referral.id, 'close', { outcome });
                  setCloseDialogOpen(false);
                }}>
                  {t('referrals.closeReferral', 'Close Referral')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
