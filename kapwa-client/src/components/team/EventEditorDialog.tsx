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
import { Checkbox } from '@/components/ui/checkbox';
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
import type { TeamEvent, TeamEventInput } from '../../lib/team-api';
import { manilaDay } from './team-utils';

export interface EventEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit mode: pass the event being edited; create mode when null. */
  event?: TeamEvent | null;
  /** Read-only mode (coordinators): hides Save/Delete affordances. */
  readOnly?: boolean;
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
 * Normalize a stored repeatRule.until into the date-only form the Until
 * `<input type="date">` speaks: 'YYYY-MM-DD' passes through, an ISO instant
 * is converted to its Asia/Manila calendar day — the same domain
 * team-utils.expandRepeat compares `until` against (instance days are Manila
 * days). Invalid values fall back to '' (the empty until, i.e. no bound).
 */
function normalizeUntilDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return manilaDay(d);
}

/**
 * Create/edit an office event. Basic v1: title, start/end, weekly repeat
 * (interval + until), visibility, location, notes. Task 13: readOnly mode
 * (coordinators) + confirm-before-delete.
 */
export function EventEditorDialog({
  open,
  onOpenChange,
  event = null,
  readOnly = false,
  onSave,
  onDelete,
}: EventEditorDialogProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [interval, setInterval] = useState<string>('1');
  const [until, setUntil] = useState('');
  const [visibleTo, setVisibleTo] = useState<string>('staff');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

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
      // Round-trip: an instant until becomes date-only, which includes the boundary instance (instants excluded it).
      setUntil(
        weekly && rule && typeof rule.until === 'string' ? normalizeUntilDate(rule.until) : '',
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
    if (readOnly || !title.trim() || !startsAt || !endsAt) return;
    const intervalN = Math.max(1, Number.parseInt(interval, 10) || 1);
    void onSave({
      title: title.trim(),
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      ...(repeatWeekly
        ? { repeatRule: { freq: 'weekly', interval: intervalN, ...(until ? { until } : {}) } }
        : { repeatRule: null }),
      visibleTo,
      ...(location.trim() ? { location: location.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
  };

  const handleDelete = () => {
    // Delete is destructive — confirm before emitting.
    if (!readOnly && event && onDelete) setConfirmDeleteOpen(true);
  };

  const confirmDelete = () => {
    setConfirmDeleteOpen(false);
    if (event && onDelete) void onDelete(event.id);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? t('team.eventEditor.editTitle') : t('team.eventEditor.newTitle')}</DialogTitle>
          <DialogDescription>
            {editing ? t('team.eventEditor.editDesc') : t('team.eventEditor.newDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="event-title">{t('team.eventEditor.titleLabel')}</Label>
            <Input
              id="event-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={t('team.eventEditor.titlePlaceholder')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="event-start">{t('team.eventEditor.startsLabel')}</Label>
              <Input id="event-start" type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="event-end">{t('team.eventEditor.endsLabel')}</Label>
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
              {t('team.eventEditor.repeatWeekly')}
            </label>
            {repeatWeekly && (
              <>
                <label className="flex items-center gap-1.5 text-sm" htmlFor="event-interval">
                  {t('team.eventEditor.every')}
                  <Input
                    id="event-interval"
                    type="number"
                    min={1}
                    max={52}
                    value={interval}
                    onChange={e => setInterval(e.target.value)}
                    className="h-8 w-16"
                    aria-label={t('team.eventEditor.repeatIntervalAria')}
                  />
                  {t('team.eventEditor.weekSuffix')}
                </label>
                <label className="flex items-center gap-1.5 text-sm" htmlFor="event-until">
                  {t('team.eventEditor.until')}
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
            <Label htmlFor="event-visibility">{t('team.eventEditor.visibilityLabel')}</Label>
            <Select value={visibleTo} onValueChange={setVisibleTo}>
              <SelectTrigger id="event-visibility" className="w-full">
                <SelectValue placeholder={t('team.eventEditor.visibilityPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">{t('team.eventEditor.visibilityStaff')}</SelectItem>
                <SelectItem value="staff_coordinators">{t('team.eventEditor.visibilityStaffCoordinators')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="event-location">{t('team.eventEditor.locationLabel')}</Label>
            <Input
              id="event-location"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder={t('team.eventEditor.locationPlaceholder')}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="event-notes">{t('team.eventEditor.notesLabel')}</Label>
            <Textarea
              id="event-notes"
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={t('team.eventEditor.notesPlaceholder')}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {!readOnly && editing && onDelete ? (
            <Button variant="destructive" onClick={handleDelete}>
              {t('team.eventEditor.delete')}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('team.eventEditor.cancel')}
            </Button>
            {!readOnly && (
              <Button onClick={handleSave} disabled={!title.trim() || !startsAt || !endsAt}>
                {editing ? t('team.eventEditor.saveChanges') : t('team.eventEditor.create')}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('team.eventEditor.deleteTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('team.eventEditor.deleteDesc', { title: title.trim() || t('team.eventEditor.titleFallback') })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('team.eventEditor.cancel')}</AlertDialogCancel>
          <Button variant="destructive" onClick={confirmDelete}>
            {t('team.eventEditor.delete')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  );
}