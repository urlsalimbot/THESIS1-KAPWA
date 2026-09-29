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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TeamEvent, TeamEventInput } from '../../lib/team-api';

export interface EventEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit mode: pass the event being edited; create mode when null. */
  event?: TeamEvent | null;
  onSave: (input: TeamEventInput) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
}

/** ISO instant → `<input type="datetime-local">` value (host-local wall time). */
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

/**
 * Create/edit an office event. Basic v1: title, start/end, weekly repeat
 * (interval + until), visibility, location, notes. Task 13 refines the
 * repeat + visibility affordances.
 */
export function EventEditorDialog({
  open,
  onOpenChange,
  event = null,
  onSave,
  onDelete,
}: EventEditorDialogProps) {
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [interval, setInterval] = useState<string>('1');
  const [until, setUntil] = useState('');
  const [visibleTo, setVisibleTo] = useState<string>('staff');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    if (event) {
      setTitle(event.title);
      setStartsAt(toLocalInputValue(event.startsAt));
      setEndsAt(toLocalInputValue(event.endsAt ?? event.startsAt));
      const rule = event.repeatRule;
      const weekly = rule && typeof rule.freq === 'string' && rule.freq.toLowerCase() === 'weekly';
      setRepeatWeekly(Boolean(weekly));
      setInterval(
        weekly && rule && typeof rule.interval === 'number' ? `${rule.interval}` : '1',
      );
      setUntil(
        weekly && rule && typeof rule.until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rule.until)
          ? rule.until
          : '',
      );
      setVisibleTo(event.visibleTo);
      setLocation(event.location ?? '');
      setNotes(event.notes ?? '');
    } else {
      setTitle('');
      setStartsAt('');
      setEndsAt('');
      setRepeatWeekly(false);
      setInterval('1');
      setUntil('');
      setVisibleTo('staff');
      setLocation('');
      setNotes('');
    }
  }, [open, event]);

  const editing = Boolean(event);

  const handleSave = () => {
    if (!title.trim() || !startsAt || !endsAt) return;
    const intervalN = Math.max(1, Number.parseInt(interval, 10) || 1);
    void onSave({
      title: title.trim(),
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      ...(repeatWeekly
        ? { repeatRule: { freq: 'weekly', interval: intervalN, ...(until ? { until } : {}) } }
        : {}),
      visibleTo,
      ...(location.trim() ? { location: location.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
  };

  const handleDelete = () => {
    if (event && onDelete) void onDelete(event.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit event' : 'New event'}</DialogTitle>
          <DialogDescription>
            {editing ? 'Update this office event for the team.' : 'Schedule an office event.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="event-title">Title</Label>
            <Input
              id="event-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Weekly team meeting"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="event-start">Starts</Label>
              <Input id="event-start" type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="event-end">Ends</Label>
              <Input id="event-end" type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border p-2.5">
            <label className="flex items-center gap-2 text-sm" htmlFor="event-repeat">
              <Checkbox
                id="event-repeat"
                checked={repeatWeekly}
                onCheckedChange={(checked) => setRepeatWeekly(checked === true)}
              />
              Repeat weekly
            </label>
            {repeatWeekly && (
              <>
                <label className="flex items-center gap-1.5 text-sm" htmlFor="event-interval">
                  Every
                  <Input
                    id="event-interval"
                    type="number"
                    min={1}
                    max={52}
                    value={interval}
                    onChange={e => setInterval(e.target.value)}
                    className="h-8 w-16"
                    aria-label="Repeat interval in weeks"
                  />
                  week(s)
                </label>
                <label className="flex items-center gap-1.5 text-sm" htmlFor="event-until">
                  Until
                  <Input
                    id="event-until"
                    type="date"
                    value={until}
                    onChange={e => setUntil(e.target.value)}
                    className="h-8 w-36"
                  />
                </label>
              </>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="event-visibility">Visible to</Label>
            <Select value={visibleTo} onValueChange={setVisibleTo}>
              <SelectTrigger id="event-visibility" className="w-full">
                <SelectValue placeholder="Visibility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">MSWDO staff</SelectItem>
                <SelectItem value="staff_coordinators">Staff + coordinators</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="event-location">Location</Label>
            <Input
              id="event-location"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="event-notes">Notes</Label>
            <Textarea
              id="event-notes"
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {editing && onDelete ? (
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
            <Button onClick={handleSave} disabled={!title.trim() || !startsAt || !endsAt}>
              {editing ? 'Save changes' : 'Create event'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}