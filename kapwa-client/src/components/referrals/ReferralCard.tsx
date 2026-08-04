import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { InterAgencyReferral, STATUS_LABELS, StatusTimeline } from './referral-utils';

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
    : 'Person';

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
            {STATUS_LABELS[referral.status]}
          </Badge>
        </div>
      </div>
      <p className="text-sm">{referral.reason}</p>
      <p className="text-xs text-muted-foreground">
        Basis: {referral.legalBasisCode} · {new Date(referral.createdAt).toLocaleDateString()}
      </p>
      {referral.notes && <p className="text-xs text-muted-foreground">Notes: {referral.notes}</p>}
      {referral.outcome && <p className="text-xs text-muted-foreground">Outcome: {referral.outcome}</p>}
      {referral.declinedReason && (
        <p className="text-xs text-destructive">Declined: {referral.declinedReason}</p>
      )}
      {canReceive && (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onTransition(referral.id, 'receive')} disabled={disabled}>
            Receive
          </Button>
          <AlertDialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" disabled={disabled}>
                Decline
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Decline Referral?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will decline the referral for this beneficiary. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep Referral</AlertDialogCancel>
                <AlertDialogAction onClick={async () => {
                  await onTransition(referral.id, 'decline', { declinedReason: 'Unable to accommodate' });
                  setDeclineDialogOpen(false);
                }}>
                  Decline
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
      {canAction && (
        <Button size="sm" onClick={() => onTransition(referral.id, 'action')} disabled={disabled}>
          Mark Actioned
        </Button>
      )}
      {canClose && (
        <div className="flex gap-2 items-end">
          <input
            value={outcome}
            onChange={e => setOutcome(e.target.value)}
            placeholder="Outcome"
            className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          />
          <AlertDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                disabled={disabled || !outcome.trim()}
              >
                Close
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Close Referral?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently close the referral for this beneficiary. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep Open</AlertDialogCancel>
                <AlertDialogAction onClick={async () => {
                  await onTransition(referral.id, 'close', { outcome });
                  setCloseDialogOpen(false);
                }}>
                  Close Referral
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
