import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BLOCK_TYPES, BLOCK_TYPE_LABEL_KEYS } from './team-utils';
import type { TeamInviteInput, TeamStaffAchievement } from '../../lib/team-api';

export interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Roster the suggester can pick a target from (achievements.perStaff). */
  staff: TeamStaffAchievement[];
  /** The signed-in user — excluded from the target list (server also rejects self-invites). */
  myUserId: string;
  /** Create-mode prefill (from clicking a colleague's empty slot). */
  staffId?: string | null;
  date?: string | null; // YYYY-MM-DD
  /** Emits the suggestion; the page posts + revalidates + toasts. */
  onSend: (input: TeamInviteInput) => Promise<void> | void;
}

/**
 * "Suggest a schedule" dialog (amendment): staff suggest a block for a
 * colleague on a date — the colleague then Accepts (materializing the block
 * as their own) or Declines. Prefilled from a clicked colleague slot, or
 * blank from the header Suggest button. Sender CANNOT pick themselves: the
 * server rejects self-invites, and the target list excludes myUserId.
 */
export function InviteDialog({
  open,
  onOpenChange,
  staff,
  myUserId,
  staffId,
  date,
  onSend,
}: InviteDialogProps) {
  const { t } = useTranslation();
  const [toUserId, setToUserId] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [blockType, setBlockType] = useState<string>(BLOCK_TYPES[0]);
  const [note, setNote] = useState('');

  const targets = staff.filter(member => member.userId !== myUserId);

  useEffect(() => {
    if (!open) return;
    setToUserId(staffId && staffId !== myUserId ? staffId : '');
    setDateStr(date ?? '');
    setBlockType(BLOCK_TYPES[0]);
    setNote('');
  }, [open, staffId, date, myUserId]);

  const handleSend = () => {
    if (!toUserId || !dateStr) return;
    void onSend({
      toUserId,
      inviteDate: dateStr,
      blockType,
      ...(note.trim() ? { note: note.trim() } : {}),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('team.invite.suggestTitle')}</DialogTitle>
          <DialogDescription>{t('team.invite.suggestDesc')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="invite-staff">{t('team.invite.staffLabel')}</Label>
            <Select value={toUserId} onValueChange={setToUserId} disabled={targets.length === 0}>
              <SelectTrigger id="invite-staff" className="w-full">
                <SelectValue placeholder={t('team.invite.staffPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {targets.map(member => (
                  <SelectItem key={member.userId} value={member.userId}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="invite-date">{t('team.invite.dateLabel')}</Label>
            <Input
              id="invite-date"
              type="date"
              value={dateStr}
              onChange={e => setDateStr(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="invite-type">{t('team.invite.typeLabel')}</Label>
            <Select value={blockType} onValueChange={setBlockType}>
              <SelectTrigger id="invite-type" className="w-full">
                <SelectValue placeholder={t('team.invite.typePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {BLOCK_TYPES.map(type => {
                  const typeKey = BLOCK_TYPE_LABEL_KEYS[type] ?? type;
                  return (
                    <SelectItem key={type} value={type}>
                      {t(typeKey, typeKey)}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="invite-note">{t('team.invite.noteLabel')}</Label>
            <Textarea
              id="invite-note"
              rows={2}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={t('team.invite.notePlaceholder')}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('team.invite.cancel')}
          </Button>
          <Button onClick={handleSend} disabled={!toUserId || !dateStr}>
            {t('team.invite.send')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}