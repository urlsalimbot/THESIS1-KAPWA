import { useState } from 'react';
import { Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '../../lib/format';
import { BLOCK_TYPE_LABEL_KEYS } from './team-utils';
import type { TeamInvite } from '../../lib/team-api';

export interface IncomingInvitesPanelProps {
  /** Pending invites addressed to the signed-in user (GET /team/invites/incoming). */
  invites: TeamInvite[];
  /** Accept materializes the suggested block as the invitee's own (PATCH …/accept → TeamBlock). */
  onAccept: (id: string) => void | Promise<void>;
  /** Decline records the refusal (PATCH …/decline). */
  onDecline: (id: string) => void | Promise<void>;
}

/**
 * Incoming schedule-suggestion inbox (amendment): a bell in the page header
 * showing how many colleagues are waiting on the viewer's answer; the dialog
 * lists each pending invite (sender, date, type, note) with Accept/Decline.
 * Rendered ONLY for staff roles — the page hides it for coordinators (read-only
 * on the workspace; the server 403s them before these handlers run).
 */
export function IncomingInvitesPanel({ invites, onAccept, onDecline }: IncomingInvitesPanelProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const pending = invites.filter(invite => invite.status === 'pending');

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        aria-label={t('team.invite.bellAria')}
        onClick={() => setOpen(true)}
        className="relative"
      >
        <Bell size={14} />
        {pending.length > 0 && (
          <Badge
            variant="destructive"
            className="absolute -right-1.5 -top-1.5 h-4 min-w-4 px-1 text-[9px] leading-4"
            aria-label={t('team.invite.pendingCount', { count: pending.length })}
          >
            {pending.length}
          </Badge>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('team.invite.inboxTitle')}</DialogTitle>
            <DialogDescription>{t('team.invite.inboxDesc')}</DialogDescription>
          </DialogHeader>

          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {pending.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">{t('team.invite.empty')}</p>
            )}
            {pending.map(invite => {
              const typeKey = BLOCK_TYPE_LABEL_KEYS[invite.blockType] ?? invite.blockType;
              return (
                <div
                  key={invite.id}
                  className="rounded-lg border bg-card p-3"
                  data-testid={`invite-row-${invite.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {t('team.invite.from', { name: invite.senderName ?? t('team.invite.unknownSender') })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(invite.inviteDate)} · {t(typeKey, typeKey)}
                      </p>
                      {invite.note && <p className="mt-1 text-xs text-muted-foreground">{invite.note}</p>}
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <Button size="sm" onClick={() => void onAccept(invite.id)}>
                        {t('team.invite.accept')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void onDecline(invite.id)}
                      >
                        {t('team.invite.decline')}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}