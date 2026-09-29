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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { BLOCK_TYPES, BLOCK_TYPE_LABEL_KEYS } from './team-utils';
import type { TeamBlock, TeamBlockInput, TeamStaffAchievement, TeamVisibleTo } from '../../lib/team-api';

export interface BlockEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: TeamStaffAchievement[];
  /** Create-mode prefill (from a clicked grid slot). */
  staffId?: string | null;
  date?: string | null; // YYYY-MM-DD
  /** Edit mode: pass the block being edited; create mode when null. */
  block?: TeamBlock | null;
  /** Read-only mode (coordinators): hides Save/Delete affordances. */
  readOnly?: boolean;
  onSave: (input: TeamBlockInput) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
}

/**
 * Create/edit a staff day block. One form for both paths: `block` selects
 * edit (PATCH semantics live in the parent — the dialog only emits inputs).
 * Delete is guarded by an explicit confirmation step.
 */
export function BlockEditorDialog({
  open,
  onOpenChange,
  staff,
  staffId,
  date,
  block = null,
  readOnly = false,
  onSave,
  onDelete,
}: BlockEditorDialogProps) {
  const { t } = useTranslation();
  const [userId, setUserId] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [blockType, setBlockType] = useState<string>(BLOCK_TYPES[0]);
  const [visibleTo, setVisibleTo] = useState<TeamVisibleTo>('team');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [note, setNote] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (block) {
      setUserId(block.userId);
      setDateStr(block.blockDate);
      setBlockType(block.blockType);
      // Round-trip: the stored visibility prefills the toggle (the server
      // always returns it; the guard keeps pre-amendment rows safe).
      setVisibleTo(block.visibleTo ?? 'team');
      setStartTime(block.startTime ?? '');
      setEndTime(block.endTime ?? '');
      setNote(block.note ?? '');
    } else {
      setUserId(staffId ?? '');
      setDateStr(date ?? '');
      setBlockType(BLOCK_TYPES[0]);
      setVisibleTo('team'); // amendment default: team-wide unless toggled
      setStartTime('');
      setEndTime('');
      setNote('');
    }
  }, [open, block, staffId, date]);

  const editing = Boolean(block);

  const handleSave = () => {
    if (readOnly || !userId || !dateStr) return;
    void onSave({
      userId,
      blockDate: dateStr,
      blockType,
      visibleTo,
      ...(startTime ? { startTime } : {}),
      ...(endTime ? { endTime } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    });
  };

  const handleDelete = () => {
    // Delete is destructive — confirm before emitting.
    if (!readOnly && block && onDelete) setConfirmDeleteOpen(true);
  };

  const confirmDelete = () => {
    setConfirmDeleteOpen(false);
    if (block && onDelete) void onDelete(block.id);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? t('team.blockEditor.editTitle') : t('team.blockEditor.newTitle')}</DialogTitle>
          <DialogDescription>
            {editing ? t('team.blockEditor.editDesc') : t('team.blockEditor.newDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="block-staff">{t('team.blockEditor.staffLabel')}</Label>
            <Select value={userId} onValueChange={setUserId} disabled={editing || staff.length === 0}>
              <SelectTrigger id="block-staff" className="w-full">
                <SelectValue placeholder={t('team.blockEditor.staffPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {staff.map(member => (
                  <SelectItem key={member.userId} value={member.userId}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="block-date">{t('team.blockEditor.dateLabel')}</Label>
            <Input
              id="block-date"
              type="date"
              value={dateStr}
              onChange={e => setDateStr(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="block-type">{t('team.blockEditor.typeLabel')}</Label>
            <Select value={blockType} onValueChange={setBlockType}>
              <SelectTrigger id="block-type" className="w-full">
                <SelectValue placeholder={t('team.blockEditor.typePlaceholder')} />
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
            <Label htmlFor="block-visibility">{t('team.blockEditor.visibilityLabel')}</Label>
            <Select value={visibleTo} onValueChange={v => setVisibleTo(v as TeamVisibleTo)}>
              <SelectTrigger id="block-visibility" className="w-full">
                <SelectValue placeholder={t('team.blockEditor.visibilityPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="team">{t('team.blockEditor.visibilityTeam')}</SelectItem>
                <SelectItem value="team_coordinators">{t('team.blockEditor.visibilityTeamCoordinators')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="block-start">{t('team.blockEditor.startLabel')}</Label>
              <Input id="block-start" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="block-end">{t('team.blockEditor.endLabel')}</Label>
              <Input id="block-end" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="block-note">{t('team.blockEditor.noteLabel')}</Label>
            <Textarea
              id="block-note"
              rows={2}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={t('team.blockEditor.notePlaceholder')}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {!readOnly && editing && onDelete ? (
            <Button variant="destructive" onClick={handleDelete}>
              {t('team.blockEditor.delete')}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('team.blockEditor.cancel')}
            </Button>
            {!readOnly && (
              <Button onClick={handleSave} disabled={!userId || !dateStr}>
                {editing ? t('team.blockEditor.saveChanges') : t('team.blockEditor.create')}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('team.blockEditor.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('team.blockEditor.deleteDesc', {
                type: t(
                  BLOCK_TYPE_LABEL_KEYS[blockType] ?? blockType,
                  BLOCK_TYPE_LABEL_KEYS[blockType] ?? blockType,
                ),
                name: staff.find(member => member.userId === userId)?.name ?? t('team.blockEditor.staffFallback'),
                date: dateStr,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('team.blockEditor.cancel')}</AlertDialogCancel>
            <Button variant="destructive" onClick={confirmDelete}>
              {t('team.blockEditor.delete')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}