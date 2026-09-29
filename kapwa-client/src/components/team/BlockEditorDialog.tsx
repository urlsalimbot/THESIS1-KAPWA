import { useEffect, useState } from 'react';
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
import { BLOCK_TYPES, BLOCK_TYPE_LABELS } from './team-utils';
import type { TeamBlock, TeamBlockInput, TeamStaffAchievement } from '../../lib/team-api';

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
 * Task 11 refines validation + affordances.
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
  const [userId, setUserId] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [blockType, setBlockType] = useState<string>(BLOCK_TYPES[0]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return;
    if (block) {
      setUserId(block.userId);
      setDateStr(block.blockDate);
      setBlockType(block.blockType);
      setStartTime(block.startTime ?? '');
      setEndTime(block.endTime ?? '');
      setNote(block.note ?? '');
    } else {
      setUserId(staffId ?? '');
      setDateStr(date ?? '');
      setBlockType(BLOCK_TYPES[0]);
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
      ...(startTime ? { startTime } : {}),
      ...(endTime ? { endTime } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    });
  };

  const handleDelete = () => {
    if (!readOnly && block && onDelete) void onDelete(block.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit block' : 'New block'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Update this day block for the staff member.'
              : 'Book a day block on the team schedule.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="block-staff">Staff</Label>
            <Select value={userId} onValueChange={setUserId} disabled={editing || staff.length === 0}>
              <SelectTrigger id="block-staff" className="w-full">
                <SelectValue placeholder="Select staff member" />
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
            <Label htmlFor="block-date">Date</Label>
            <Input
              id="block-date"
              type="date"
              value={dateStr}
              onChange={e => setDateStr(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="block-type">Type</Label>
            <Select value={blockType} onValueChange={setBlockType}>
              <SelectTrigger id="block-type" className="w-full">
                <SelectValue placeholder="Block type" />
              </SelectTrigger>
              <SelectContent>
                {BLOCK_TYPES.map(type => (
                  <SelectItem key={type} value={type}>
                    {BLOCK_TYPE_LABELS[type] ?? type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="block-start">Start time</Label>
              <Input id="block-start" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="block-end">End time</Label>
              <Input id="block-end" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="block-note">Note</Label>
            <Textarea
              id="block-note"
              rows={2}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Optional note"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {!readOnly && editing && onDelete ? (
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {!readOnly && (
              <Button onClick={handleSave} disabled={!userId || !dateStr}>
                {editing ? 'Save changes' : 'Create block'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}