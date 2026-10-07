import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { humanizeError } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Gavel, Lock, Plus, Trash2, Ban, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { StepLockBar, type StepLock } from './StepLockBar';
import { toast } from 'sonner';

interface CaseEventView {
  id: string;
  caseId: string;
  eventType: string;
  attended?: boolean | null;
  title?: string | null;
  venue?: string | null;
  eventDate: string;
  startTime?: string | null;
  endTime?: string | null;
  notes?: string | null;
  status: string;
}

interface StepCourtHearingsProps {
  caseId: string;
  caseData: any;
  userRole?: string;
  readOnly?: boolean;
  lockReadOnly?: boolean;
  stepLock?: StepLock | null;
}

/**
 * The Court Hearings step (spec §5.1): the legal categories' injected step.
 * Hearings recorded here drive the team-workspace calendar block and the
 * reminders for the assigned worker. `attended` is tri-state — true means the
 * office attends (block + reminders); NULL/false records a hearing the office
 * is not attending (case file only).
 */
export function StepCourtHearings({ caseId, caseData, userRole, readOnly, lockReadOnly, stepLock }: StepCourtHearingsProps) {
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();
  const { data: events, mutate: mutateEvents, isLoading } = useSWR<CaseEventView[]>(
    queryKeys.cases.events(caseId),
  );

  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    eventDate: new Date().toISOString().slice(0, 10),
    startTime: '',
    venue: '',
    title: '',
    notes: '',
    attended: true,
  });

  const refresh = async () => {
    await mutateEvents();
    await mutate(queryKeys.cases.detail(caseId));
  };

  /**
   * The step's second completion: record that this case will see no hearing, so
   * a case with none can still finish the step instead of leaving it open — and
   * with it the `active -> transitioning` gate that demands every step due at
   * `active`. Mirrors the enrollment, intervention and referral decisions.
   */
  const notNeeded = Boolean(caseData?.courtHearingsNotNeeded);
  const hasHearings = (events ?? []).some((e) => e.status !== 'cancelled');
  const [savingDecision, setSavingDecision] = useState(false);

  async function saveDecision(next: boolean) {
    setSavingDecision(true);
    try {
      await api.patch(`/cases/${caseId}/court-hearings-decision`, { notNeeded: next });
      await refresh();
    } catch (err) {
      toast.error(t('caseView.hearings.decisionFailed', 'Could not save the hearing decision'), { description: humanizeError(err) });
    } finally {
      setSavingDecision(false);
    }
  }

  async function addHearing() {
    if (!form.eventDate) return;
    setSaving(true);
    try {
      await api.post(`/cases/${caseId}/events`, {
        eventType: 'court_hearing',
        attended: form.attended,
        title: form.title || undefined,
        venue: form.venue || undefined,
        eventDate: form.eventDate,
        startTime: form.startTime || undefined,
        notes: form.notes || undefined,
      });
      toast.success(t('caseView.hearings.added', 'Hearing recorded'));
      setForm({ eventDate: new Date().toISOString().slice(0, 10), startTime: '', venue: '', title: '', notes: '', attended: true });
      setAdding(false);
      await refresh();
    } catch (e) {
      toast.error(t('caseView.hearings.addFailed', 'Could not record the hearing'), { description: humanizeError(e) });
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: string) {
    setSaving(true);
    try {
      await api.patch(`/cases/${caseId}/events/${id}`, { status });
      await refresh();
    } catch (e) {
      toast.error(t('caseView.hearings.updateFailed', 'Could not update the hearing'), { description: humanizeError(e) });
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setSaving(true);
    try {
      await api.del(`/cases/${caseId}/events/${id}`);
      await refresh();
    } catch (e) {
      toast.error(t('caseView.hearings.deleteFailed', 'Could not delete the hearing'), { description: humanizeError(e) });
    } finally {
      setSaving(false);
    }
  }

  const canEdit = !readOnly && ['admin', 'social_worker'].includes(userRole ?? '');
  const rows = (events ?? []).filter((e) => e.eventType === 'court_hearing');
  const activeCount = rows.filter((e) => e.status !== 'cancelled').length;

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <div className="rounded-lg border bg-card">
          <div className="px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Gavel size={16} className="text-primary" />
                <h3 className="text-sm font-semibold">{t('caseView.hearings.title', 'Court Hearings')}</h3>
                {notNeeded && (
                  <Badge variant="outline" className="gap-1 text-[10px]">
                    <CheckCircle2 size={10} aria-hidden="true" /> {t('caseView.hearings.notNeededBadge', 'No hearing needed')}
                  </Badge>
                )}
                {readOnly && <Lock size={14} className="text-muted-foreground" />}
              </div>
              {canEdit && (
                <div className="flex flex-wrap items-center gap-2">
                  {!notNeeded && (
                    <Button size="sm" onClick={() => setAdding(true)}>
                      <Plus size={14} className="mr-1" aria-hidden="true" /> {t('caseView.hearings.add', 'Add Hearing')}
                    </Button>
                  )}
                  {notNeeded ? (
                    <Button variant="outline" size="sm" disabled={savingDecision} onClick={() => saveDecision(false)}>
                      {t('caseView.hearings.undoDecision', 'Undo decision')}
                    </Button>
                  ) : (
                    // Held disabled once a hearing is on file: the decision says
                    // this case will see none, which a recorded hearing already
                    // contradicts — and the done-predicate is an OR, so the step
                    // is finished either way.
                    <Button variant="secondary" size="sm" disabled={savingDecision || hasHearings} onClick={() => saveDecision(true)}>
                      <Ban size={14} className="mr-1" aria-hidden="true" /> {t('caseView.hearings.notNeeded', 'No court hearings')}
                    </Button>
                  )}
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('caseView.hearings.hint', 'Court dates for this legal case. Hearings the office attends are synced to the team calendar and remind the assigned worker.')}
            </p>
          </div>
          <Separator />
          <div className="px-4 py-3 space-y-2">
            {isLoading && <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading…')}</p>}
            {rows.map((ev) => (
              <div key={ev.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {ev.title || t('caseView.hearings.defaultTitle', 'Court hearing')}
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      ev.attended === true ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      {ev.attended === true
                        ? t('caseView.hearings.attendingBadge', 'Attending')
                        : t('caseView.hearings.notAttendingBadge', 'Not attending')}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ev.eventDate}{ev.startTime ? ` · ${ev.startTime}` : ''}{ev.venue ? ` · ${ev.venue}` : ''}
                    {ev.status !== 'planned' ? ` · ${ev.status}` : ''}
                  </p>
                </div>
                {canEdit && ev.status === 'planned' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => setStatus(ev.id, 'done')} disabled={saving}>
                      {t('caseView.hearings.complete', 'Mark Done')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setStatus(ev.id, 'cancelled')} disabled={saving}>
                      {t('caseView.hearings.cancel', 'Cancel Hearing')}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => remove(ev.id)} aria-label={t('caseView.hearings.delete', 'Delete')}>
                      <Trash2 size={14} aria-hidden="true" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {!isLoading && rows.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t('caseView.hearings.empty', 'No hearings recorded yet')}
              </p>
            )}
          </div>
          {canEdit && adding && (
            <>
              <Separator />
              <div className="px-4 py-3">
                <div className="flex flex-wrap items-end gap-2">
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">{t('caseView.hearings.date', 'Date')} *</span>
                    <Input type="date" className="w-44" value={form.eventDate} onChange={(e) => setForm((f) => ({ ...f, eventDate: e.target.value }))} />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">{t('caseView.hearings.time', 'Time')}</span>
                    <Input type="time" className="w-32" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
                  </label>
                  <label className="space-y-1.5 min-w-48 flex-1">
                    <span className="text-xs font-medium text-muted-foreground">{t('caseView.hearings.venue', 'Venue / Court')}</span>
                    <Input value={form.venue} onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))} />
                  </label>
                  <label className="space-y-1.5 min-w-48 flex-1">
                    <span className="text-xs font-medium text-muted-foreground">{t('caseView.hearings.notes', 'Notes')}</span>
                    <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
                  </label>
                  <label className="flex items-center gap-2 pb-2 text-xs font-medium text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={form.attended}
                      onChange={(e) => setForm((f) => ({ ...f, attended: e.target.checked }))}
                    />
                    {t('caseView.hearings.attending', 'Office will attend')}
                  </label>
                  <Button size="sm" onClick={addHearing} disabled={saving || !form.eventDate}>
                    {t('caseView.hearings.save', 'Save Hearing')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>{t('common.cancel', 'Cancel')}</Button>
                </div>
              </div>
            </>
          )}
        </div>

        <StepLockBar
          caseId={caseId}
          stepKey="court_hearings"
          caseData={caseData}
          interventionCount={0}
          enrollmentCount={0}
          opts={{ courtHearingCount: activeCount }}
          locked={stepLock}
          readOnly={lockReadOnly}
          onChanged={async () => mutate(queryKeys.cases.detail(caseId))}
        />
      </section>
    </div>
  );
}