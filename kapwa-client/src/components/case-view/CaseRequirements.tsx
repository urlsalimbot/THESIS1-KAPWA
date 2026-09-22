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
import { mandatoryDocumentKeys, optionalDocumentKeys } from '@/lib/case-progress';

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
}

// Documentary-needs checklist shared by the Implement HIP step (step 2) and the
// Service Delivery step (step 3). One source of truth for "is this requirement
// satisfied" so the checklist, the stepper and the server activation gate agree.
//
// A need is satisfied when its case_requirements entry is met. That happens when
// the worker confirms an uploaded document on-site, uploads it at the office, or
// records that the client passed it on-site directly. Claimant (remote) uploads
// stay pending until confirmed.
export function CaseRequirements({ caseId, caseData, userRole }: CaseRequirementsProps) {
  const { t } = useTranslation();
  const { mutate: globalMutate } = useSWRConfig();
  const { data: interventions = [] } = useSWR<any[]>(queryKeys.cases.interventions(caseId));
  const { data: programs = [] } = useSWR<Program[]>(queryKeys.programs.list());
  const { data: docs = [] } = useSWR<any[]>(
    caseId ? queryKeys.filing.byCase(caseId) : null,
  );
  const [saving, setSaving] = useState(false);

  const checklist = (caseData?.requirementsChecklist || {}) as Record<string, boolean>;

  const programIds = [...new Set(interventions.map((i: any) => i.programId).filter(Boolean))];
  const relevantPrograms = programs.filter((p) => programIds.includes(p.id));
  const allRequirements = [
    ...new Set(relevantPrograms.flatMap((p) => mandatoryDocumentKeys(p))),
  ];
  const optionalRequirements = [
    ...new Set(relevantPrograms.flatMap((p) => optionalDocumentKeys(p))),
  ].filter((k) => !allRequirements.includes(k));

  const docsByRequirement: Record<string, any[]> = {};
  for (const d of docs) {
    const k = d.requirementKey;
    if (!k) continue;
    if (!docsByRequirement[k]) docsByRequirement[k] = [];
    docsByRequirement[k].push(d);
  }

  const canUpload = Boolean(userRole && ['admin', 'social_worker', 'coordinator', 'claimant'].includes(userRole));
  const canVerify = Boolean(userRole && ['admin', 'social_worker'].includes(userRole));

  if (allRequirements.length === 0 && optionalRequirements.length === 0) return null;

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

  return (
    <div className="rounded-lg border bg-card">
      <div className="px-4 py-3 flex items-center gap-2">
        <FileCheck size={16} className="text-primary" />
        <h3 className="text-sm font-semibold">{t('caseView.implement.requirements', 'Requirements')}</h3>
        <span className="text-xs text-muted-foreground ml-auto">
          {completedCount}/{allRequirements.length} {t('caseView.implement.complete', 'complete')}
        </span>
      </div>
      <Separator />
      <div className="px-4 py-3 space-y-2">
        {[...allRequirements.map((req) => ({ req, optional: false })), ...optionalRequirements.map((req) => ({ req, optional: true }))].map(({ req, optional }) => {
          const done = checklist[req] === true;
          const uploadedDocs = docsByRequirement[req] || [];
          return (
            <div key={req} className="border rounded-md overflow-hidden">
              <div className="flex items-center gap-3 px-3 py-2">
                <button
                  type="button"
                  onClick={() => canVerify && setRequirementMet(req, !done)}
                  disabled={saving || !canVerify}
                  title={canVerify
                    ? t('caseView.implement.onSiteDirectHint', 'Mark that the client passed this requirement on-site directly')
                    : undefined}
                  className="flex items-center gap-3 flex-1 text-left disabled:cursor-default"
                >
                  {done
                    ? <CheckCircle2 size={18} className="text-primary shrink-0" />
                    : <Circle size={18} className="text-muted-foreground shrink-0" />
                  }
                  <span className={`text-sm ${done ? 'text-muted-foreground' : ''}`}>{req}</span>
                  {optional && (
                    <Badge variant="outline" className="text-[10px]">
                      {t('caseView.implement.optional', 'Optional')}
                    </Badge>
                  )}
                </button>
                {uploadedDocs.length > 0 && (
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <FileText size={10} /> {uploadedDocs.length}
                  </Badge>
                )}
              </div>

              {uploadedDocs.length > 0 && (
                <div className="px-3 pb-1 space-y-1">
                  {uploadedDocs.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-2 text-xs text-muted-foreground pl-9">
                      <FileText size={14} className="shrink-0" />
                      <span className="truncate flex-1">{doc.originalName || doc.id}</span>
                      {doc.verifiedAt ? (
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <ShieldCheck size={10} /> {t('caseView.implement.verifiedOnSite', 'Verified on-site')}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <Clock size={10} /> {t('caseView.implement.pendingOnSite', 'Pending on-site')}
                        </Badge>
                      )}
                      {canVerify && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5"
                          disabled={saving}
                          onClick={() => setVerified(doc.id, !doc.verifiedAt)}
                        >
                          {doc.verifiedAt
                            ? t('caseView.implement.unverify', 'Undo')
                            : t('caseView.implement.verify', 'Verify on-site')}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <RequirementFileUpload
                caseId={caseId}
                requirementKey={req}
                canUpload={canUpload}
                docs={uploadedDocs}
                onChanged={refresh}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
