import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { humanizeError } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FileCheck, CheckCircle2, Circle, FileText, ShieldCheck, Clock } from 'lucide-react';
import { RequirementFileUpload } from './RequirementFileUpload';
import { requiredDocumentKeys } from '@/lib/case-progress';

interface Program {
  id: string;
  name: string;
  category?: string;
  requiredDocuments?: string[];
  requiredDocumentDetails?: Array<{ key: string; mandatory: boolean }>;
}

interface CaseRequirementsProps {
  caseId: string;
  caseData: any;
  userRole?: string;
  /** Programs chosen in the step's form but not yet saved as interventions.
   *  Nothing about such a selection is persisted, so the step hands its ids in
   *  and the checklist lists their documents: a worker learns what a program
   *  will demand while choosing it, not after committing to it. */
  extraProgramIds?: string[];
  /** Replaces the "every program behind a saved intervention" half of the
   *  scope; `extraProgramIds` is appended either way. The step passes the one
   *  intervention it is embedding the checklist into, so a card lists its own
   *  program's documents and no other's, and the header passes its unsaved
   *  selection alone — the saved ones have moved into those cards. Omit it and
   *  the scope is the whole case, which is what every existing caller wants. */
  programIds?: string[];
  /** Render as a section of a card that already exists. The merged
   *  intervention card brings its own border and separator, so a second pair
   *  inside it would draw a box within a box. */
  embedded?: boolean;
  /** A sealed step's checklist is read-only: the server refuses every write it
   *  guards, so the controls go with them. Reading a document stays allowed. */
  readOnly?: boolean;
}

// Documentary-needs checklist shared by the Implement HIP step (step 2) and the
// Service Delivery step (step 3). One source of truth for "is this requirement
// satisfied" so the checklist, the stepper and the server activation gate agree.
//
// A need is satisfied when its case_requirements entry is met. That happens when
// the worker confirms an uploaded document on-site, uploads it at the office, or
// records that the client passed it on-site directly. Claimant (remote) uploads
// stay pending until confirmed.
export function CaseRequirements({ caseId, caseData, userRole, extraProgramIds, programIds: scopeProgramIds, embedded, readOnly }: CaseRequirementsProps) {
  const { t } = useTranslation();
  const { mutate: globalMutate } = useSWRConfig();
  const { data: interventions = [] } = useSWR<any[]>(queryKeys.cases.interventions(caseId));
  const { data: programs = [] } = useSWR<Program[]>(queryKeys.programs.list());
  const { data: docs = [] } = useSWR<any[]>(
    caseId ? queryKeys.filing.byCase(caseId) : null,
  );
  const [saving, setSaving] = useState(false);

  const checklist = (caseData?.requirementsChecklist || {}) as Record<string, boolean>;

  // The programs in scope: the caller's override (one intervention card's own
  // program, or the header's unsaved selection) standing in for the saved ones,
  // plus the ids the step currently has selected. Falsy ids are dropped because
  // an ad-hoc service names no program — its documents are nobody's to preview.
  // This list may repeat an id (one program can back several interventions, and
  // the override can name one that is also selected), which is harmless: the
  // `filter` below walks `programs` once, so a program still contributes a single
  // entry. The de-duplication that matters is on the requirement *keys*, because
  // two programs can demand the same document.
  const programIds = [
    ...(scopeProgramIds ?? interventions.map((i: any) => i.programId)),
    ...(extraProgramIds ?? []),
  ].filter((id): id is string => Boolean(id));
  const relevantPrograms = programs.filter((p) => programIds.includes(p.id));
  const allRequirements = [
    ...new Set(relevantPrograms.flatMap((p) => requiredDocumentKeys(p))),
  ];

  const docsByRequirement: Record<string, any[]> = {};
  for (const d of docs) {
    const k = d.requirementKey;
    if (!k) continue;
    if (!docsByRequirement[k]) docsByRequirement[k] = [];
    docsByRequirement[k].push(d);
  }

  const canUpload = Boolean(userRole && ['admin', 'social_worker', 'coordinator', 'claimant'].includes(userRole));
  const canVerify = Boolean(userRole && ['admin', 'social_worker'].includes(userRole));

  if (allRequirements.length === 0) return null;

  const refresh = async () => {
    await globalMutate(queryKeys.cases.detail(caseId));
    await globalMutate(queryKeys.filing.byCase(caseId));
  };

  async function setRequirementMet(key: string, met: boolean) {
    setSaving(true);
    try {
      await api.patch(`/cases/${caseId}/requirements`, { requirementsChecklist: { ...checklist, [key]: met } });
      await refresh();
    } catch (e: any) {
      toast.error(t('caseView.implement.requirementUpdateFailed', 'Could not update requirement'), { description: humanizeError(e) });
    } finally {
      setSaving(false);
    }
  }

  async function setVerified(docId: string, verified: boolean) {
    setSaving(true);
    try {
      await api.patch(`/filing/${docId}/verify`, { verified });
      await refresh();
    } catch (e: any) {
      toast.error(t('caseView.implement.verifyFailed', 'Could not update verification'), { description: humanizeError(e) });
    } finally {
      setSaving(false);
    }
  }

  const completedCount = allRequirements.filter((r) => checklist[r]).length;

  /* Whether this list is counting something the record does not hold yet.
     A selection is not an intervention, so "2/2 complete" beside a program the
     worker has not saved would read as though that program had been issued and
     its paperwork closed out. The clause names the extra source instead of
     qualifying the number, which keeps the arithmetic — the thing the seal
     weighs — exactly as it was. */
  const savedProgramIds = new Set(interventions.map((i: any) => i.programId).filter(Boolean));
  const knownProgramIds = new Set(programs.map((p) => p.id));
  // Only a selection that resolves to a listed program can add a requirement, so
  // an id no program matches must not make the count claim it includes one. Read
  // over the whole scope rather than `extraProgramIds` alone, because a caller
  // that overrides the scope hands its unsaved selection in the same prop — and
  // an id already on the record is not a preview of anything.
  const previewing = programIds.some((id) => knownProgramIds.has(id) && !savedProgramIds.has(id));

  return (
    <div className={embedded ? undefined : 'rounded-lg border bg-card'}>
      <div className="px-4 py-3 flex items-center gap-2">
        <FileCheck size={16} className="text-primary" />
        <h3 className="text-sm font-semibold">{t('caseView.implement.requirements', 'Requirements')}</h3>
        <span className="text-xs text-muted-foreground ml-auto">
          {completedCount}/{allRequirements.length}{' '}
          {previewing
            ? t('caseView.implement.completePreviewing', 'complete (includes the program you selected)')
            : t('caseView.implement.complete', 'complete')}
        </span>
      </div>
      {!embedded && <Separator />}
      <div className="px-4 py-3 space-y-2">
        {allRequirements.map((req) => {
          const done = checklist[req] === true;
          const uploadedDocs = docsByRequirement[req] || [];
          return (
            <div key={req} className="border rounded-md overflow-hidden">
              <div className="flex items-center gap-3 px-3 py-2">
                {/* The label is not a control. It used to be a full-row button
                    that flipped the requirement, which made satisfying a
                    documentary need invisible: a worker clicking a heading had
                    no way to know they were recording a decision. */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {done
                    ? <CheckCircle2 size={18} className="text-primary shrink-0" />
                    : <Circle size={18} className="text-muted-foreground shrink-0" />
                  }
                  <span className={`text-sm ${done ? 'text-muted-foreground' : ''}`}>{req}</span>
                </div>
                {uploadedDocs.length > 0 && (
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <FileText size={10} /> {uploadedDocs.length}
                  </Badge>
                )}
                {/* The one case no document can cover: the client handed the
                    original over on-site and nothing was scanned. Kept as an
                    explicit control so it stops hiding behind a heading click. */}
                {canVerify && !readOnly && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0 text-xs"
                    disabled={saving}
                    title={t('caseView.implement.onSiteDirectHint', 'Record that the client passed this on-site with no copy uploaded')}
                    onClick={() => setRequirementMet(req, !done)}
                  >
                    {done
                      ? t('caseView.implement.undoOnSiteDirect', 'Undo')
                      : t('caseView.implement.passedOnSiteNoCopy', 'Passed on-site, no copy')}
                  </Button>
                )}
              </div>

              {/* The file list is the single place an uploaded document appears.
                  Its review status rides along in the file row (renderDocExtras)
                  instead of a second, near-identical listing. */}
              <RequirementFileUpload
                caseId={caseId}
                requirementKey={req}
                canUpload={canUpload}
                readOnly={readOnly}
                docs={uploadedDocs}
                onChanged={refresh}
                renderDocExtras={(doc) => {
                  const verifiedAt = (doc as { verifiedAt?: string | null }).verifiedAt;
                  const statusLabel = verifiedAt
                    ? t('caseView.implement.reviewedOnSite', 'Reviewed on-site')
                    : t('caseView.implement.pendingOnSite', 'Pending review');
                  return (
                    <div className="flex shrink-0 items-center gap-1.5" title={statusLabel}>
                      {verifiedAt ? (
                        <Badge variant="secondary" className="gap-1 text-[10px]">
                          <ShieldCheck size={10} /> <span className="hidden sm:inline">{statusLabel}</span>
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-[10px]">
                          <Clock size={10} /> <span className="hidden sm:inline">{statusLabel}</span>
                        </Badge>
                      )}
                    </div>
                  );
                }}
                /* "Review" is the worker's act of reading the single document
                   against the requirement, so the control that records it lives
                   in the preview dialog — the only place the document is
                   actually on screen. It is the same server flag as on-site
                   verification, so the checklist, the stepper and the activation
                   gate cannot disagree about what is satisfied. */
                renderPreviewFooter={(doc) => {
                  if (!canVerify || readOnly) return null;
                  const verifiedAt = (doc as { verifiedAt?: string | null }).verifiedAt;
                  return (
                    <Button
                      variant={verifiedAt ? 'outline' : 'default'}
                      size="sm"
                      disabled={saving}
                      onClick={() => setVerified(doc.id, !verifiedAt)}
                    >
                      {verifiedAt
                        ? t('caseView.implement.unverify', 'Undo')
                        : t('caseView.implement.confirmReview', 'Confirm review')}
                    </Button>
                  );
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
