import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { InterAgencyReferral } from './referral-utils';
import { useTranslation } from 'react-i18next';

export function ReferralActions({
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

  if (!canReceive && !canAction && !canClose && !canDecline) return null;

  return (
    <div className="flex flex-wrap items-end gap-2">
      {canReceive && (
        <>
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
        </>
      )}
      {canAction && (
        <Button size="sm" onClick={() => onTransition(referral.id, 'action')} disabled={disabled}>
          {t('referrals.markActioned', 'Mark Actioned')}
        </Button>
      )}
      {canClose && (
        <>
          <input
            value={outcome}
            onChange={e => setOutcome(e.target.value)}
            placeholder={t('referrals.outcome', 'Outcome')}
            className="flex-1 min-w-[160px] rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          />
          <AlertDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button size="sm" disabled={disabled || !outcome.trim()}>
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
        </>
      )}
    </div>
  );
}
