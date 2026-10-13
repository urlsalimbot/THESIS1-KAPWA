import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { humanizeError } from '@/lib/errors';
import { toastSaved } from '@/lib/toast';
import { programTypeAllowedForCaseCategory } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { CalendarClock, Lock, Plus, Trash2 } from 'lucide-react';
import { StepLockBar, type StepLock } from './StepLockBar';
import { CaseRequirements } from './CaseRequirements';
import { toast } from 'sonner';

interface ProgramEnrollmentView {
  id: string;
  caseId: string;
  programId: string;
  programName: string;
  programType?: string;
  services?: string[];
  enrolledAt: string;
  status: string;
  createdAt: string;
}

interface StepEnrollmentsProps {
  caseId: string;
  caseData: any;
  userRole?: string;
  readOnly?: boolean;
  lockReadOnly?: boolean;
  stepLock?: StepLock | null;
  // The enrolled programs' documentary minimum, computed page-side (the same
  // value the header stepper reads). Passed through so THIS step's Lock agrees
  // with the header — it used to default to `true` client-side and 400 against
  // the server's enforced gate (audit 3.2.2).
  enrollmentRequirementsMet?: boolean;
}

const ENROLL_STATUSES = ['active', 'completed', 'withdrawn'] as const;

/**
 * The Program Enrollments step (spec §6.1): which MSWDO programs this case is
 * enrolled in — the treatment plan agreed after assessment. Interventions are
 * then services rendered under one of these enrollments.
 */
export function StepEnrollments({ caseId, caseData, userRole, readOnly, lockReadOnly, stepLock, enrollmentRequirementsMet }: StepEnrollmentsProps) {
  const { t } = useTranslation();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const { mutate } = useSWRConfig();
  const { data: enrollments, mutate: mutateEnrollments, isLoading } = useSWR<ProgramEnrollmentView[]>(
    queryKeys.cases.enrollments(caseId),
  );
  const { data: programs } = useSWR<Array<{ id: string; name: string; programType?: string }>>(
    ['programs'],
  );
  const notNeeded = Boolean(caseData?.enrollmentsNotNeeded);
  // Programs apply per case category (catalog Appendix B): only programs
  // applicable to this case's category are offerable — a CICL case never sees
  // Social Pension in the picker. Untyped/custom programs stay visible.
  const applicablePrograms = (programs ?? []).filter((p) =>
    programTypeAllowedForCaseCategory(p.programType, caseData?.caseCategory),
  );

  const [adding, setAdding] = useState(false);
  const [programId, setProgramId] = useState('');
  const [enrolledAt, setEnrolledAt] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    await mutateEnrollments();
    await mutate(queryKeys.cases.detail(caseId));
  };

  async function addEnrollment() {
    if (!programId) return;
    setSaving(true);
    try {
      await api.post(`/cases/${caseId}/enrollments`, { programId, enrolledAt });
      toast.success(t('caseView.enrollments.added', 'Enrollment recorded'));
      setProgramId('');
      setAdding(false);
      await refresh();
    } catch (e) {
      toast.error(t('caseView.enrollments.addFailed', 'Could not add the enrollment'), { description: humanizeError(e) });
    } finally {
      setSaving(false);
    }
  }

  async function removeEnrollment(id: string) {
    setSaving(true);
    try {
      await api.del(`/cases/${caseId}/enrollments/${id}`);
      await refresh();
      toastSaved(t('caseView.enrollments.removed', 'Enrollment removed'));
    } catch (e) {
      toast.error(t('caseView.enrollments.removeFailed', 'Could not remove the enrollment'), { description: humanizeError(e) });
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: string) {
    try {
      await api.patch(`/cases/${caseId}/enrollments/${id}`, { status });
      await refresh();
      toastSaved(t('caseView.enrollments.statusUpdated', 'Enrollment status updated'));
    } catch (e) {
      toast.error(t('caseView.enrollments.updateFailed', 'Could not update the enrollment'), { description: humanizeError(e) });
    }
  }

  async function toggleNotNeeded() {
    setSaving(true);
    try {
      await api.patch(`/cases/${caseId}/enrollments-decision`, { notNeeded: !notNeeded });
      await mutate(queryKeys.cases.detail(caseId));
      toastSaved(notNeeded
        ? t('caseView.enrollments.programsNeeded', 'Programs required again')
        : t('caseView.enrollments.noProgramNeeded', 'Recorded: no program needed'));
    } catch (e) {
      toast.error(t('caseView.enrollments.decisionFailed', 'Could not save the decision'), { description: humanizeError(e) });
    } finally {
      setSaving(false);
    }
  }

  const canEdit = !readOnly && ['admin', 'social_worker'].includes(userRole ?? '');
  const rows = enrollments ?? [];

  return (
    <div className="space-y-4">
      {/* One card, titled inside it the way the other steps are: icon and name on
          one row with the actions that complete this step beside the title they
          belong to, the statutory hint beneath, then a rule and the enrollments
          themselves. The seal stands below the card — a statement about the whole
          step, not a field of any one enrollment. */}
      <section className="space-y-2">
        <div className="rounded-lg border bg-card">
          <div className="px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarClock size={16} className="text-primary" />
                {/* `h3`, like every card heading in the case view: one heading
                    level for cards throughout, so heading-by-heading navigation
                    does not drop a level here for no reason. */}
                <h3 className="text-sm font-semibold">{t('caseView.enrollments.title', 'Program Enrollments')}</h3>
                {readOnly && <Lock size={14} className="text-muted-foreground" />}
              </div>
              {canEdit && (
                <div className="flex flex-wrap gap-2">
                  {!notNeeded && (
                    <Button size="sm" onClick={() => setAdding(true)}>
                      <Plus size={14} className="mr-1" aria-hidden="true" /> {t('caseView.enrollments.add', 'Enroll in a program')}
                    </Button>
                  )}
                  {/* The second of the two ways to complete this step, beside the
                      first: either a program is enrolled, or the case is recorded
                      as needing none. */}
                  <Button
                    size="sm"
                    variant={notNeeded ? 'secondary' : 'outline'}
                    onClick={toggleNotNeeded}
                    disabled={saving}
                    title={t('caseView.enrollments.notNeededHint', 'Record that this case needs no program enrollment')}
                  >
                    {notNeeded
                      ? t('caseView.enrollments.notNeededUndo', 'Cancel the "no enrollment needed" decision')
                      : t('caseView.enrollments.notNeededRecord', 'Record "no enrollment needed"')}
                  </Button>
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('caseView.enrollments.hint', 'The MSWDO programs this case is enrolled in — agreed after assessment (the treatment plan). Intervention services are rendered under these enrollments.')}
            </p>
          </div>
          <Separator />
          <div className="px-4 py-3 space-y-2">
            {isLoading && <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading…')}</p>}
            {rows.map((enr) => (
              <div key={enr.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{enr.programName}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('caseView.enrollments.enrolledOn', 'Enrolled {{date}}', { date: enr.enrolledAt })}
                    {enr.programType ? ` · ${enr.programType}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Select value={enr.status} disabled={!canEdit} onValueChange={(v) => setStatus(enr.id, v)}>
                    <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ENROLL_STATUSES.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {canEdit && (
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDeleteTarget(enr.id)} aria-label={t('caseView.enrollments.remove', 'Remove enrollment')}>
                      <Trash2 size={14} aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {notNeeded && (
              <p className="text-sm text-muted-foreground">
                {t('caseView.enrollments.notNeeded', 'No program enrollment needed — recorded decision.')}
              </p>
            )}
            {/* Nothing enrolled yet: an empty record, stated plainly, standing in
                for the list it would otherwise hold. */}
            {!isLoading && rows.length === 0 && !notNeeded && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t('caseView.enrollments.none', 'No programs enrolled yet.')}
              </p>
            )}
          </div>
          {canEdit && adding && (
            <>
              <Separator />
              <div className="px-4 py-3">
                <div className="flex flex-wrap items-end gap-2">
                  <label className="space-y-1.5 min-w-56 flex-1">
                    <span className="text-xs font-medium text-muted-foreground">{t('caseView.enrollments.program', 'Program *')}</span>
                    <Select value={programId || undefined} onValueChange={setProgramId}>
                      <SelectTrigger><SelectValue placeholder={t('caseView.enrollments.programPlaceholder', 'Select program…')} /></SelectTrigger>
                      <SelectContent>
                        {(applicablePrograms).map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">{t('caseView.enrollments.enrolledAt', 'Enrolled Date')}</span>
                    <Input type="date" className="w-44" value={enrolledAt} onChange={(e) => setEnrolledAt(e.target.value)} />
                  </label>
                  <Button size="sm" onClick={addEnrollment} disabled={saving || !programId}>
                    {t('common.save', 'Save')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>{t('common.cancel', 'Cancel')}</Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* The enrolled programs' documentary requirements — meeting them is
            part of the enrollment itself (the step seal weighs them). */}
        <CaseRequirements
          caseId={caseId}
          caseData={caseData}
          userRole={userRole}
          programIds={[...new Set((enrollments ?? []).map((e) => e?.programId).filter(Boolean))]}
          readOnly={readOnly}
        />

        <StepLockBar
          caseId={caseId}
          stepKey="enrollments"
          caseData={caseData}
          interventionCount={0}
          enrollmentCount={rows.length}
          opts={{ enrollmentsNotNeeded: notNeeded, enrollmentRequirementsMet }}
          locked={stepLock}
          readOnly={lockReadOnly}
          onChanged={async () => mutate(queryKeys.cases.detail(caseId))}
        />
      </section>

      {/* Destructive removal needs the confirm — a one-click delete of an
          enrollment row removes its documentary gate without a trace. */}
      <AlertDialog open={deleteTarget != null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('caseView.enrollments.removeTitle', 'Remove this enrollment?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('caseView.enrollments.removeHint', 'The enrollment and its documentary requirements will be removed from this case. This cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && removeEnrollment(deleteTarget)} className="bg-destructive text-white hover:bg-destructive/90">
              {t('common.remove', 'Remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}