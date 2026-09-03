import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Plus, Trash2, FileText, ClipboardList, ArrowRight, Landmark, Scale, Coins } from 'lucide-react';

interface WorkflowStep { stepName: string; approverRole: string; slaDays: string; }
const emptyStep = (): WorkflowStep => ({ stepName: '', approverRole: '', slaDays: '3' });

const APPROVER_ROLES = ['admin', 'social_worker', 'coordinator', 'mayor'];

export function CreateProgramPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mutate: globalMutate } = useSWRConfig();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [legalBasis, setLegalBasis] = useState('');
  const [waitingPeriodDays, setWaitingPeriodDays] = useState('7');
  const [fundSources, setFundSources] = useState<string[]>(['']);
  const [requiredDocuments, setRequiredDocuments] = useState<string[]>(['']);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([emptyStep()]);
  const [submitting, setSubmitting] = useState(false);

  function addList(setter: (v: string[]) => void, list: string[]) { setter([...list, '']); }
  function removeList(setter: (v: string[]) => void, list: string[], i: number) {
    if (list.length > 1) setter(list.filter((_, idx) => idx !== i));
  }
  function updateList(setter: (v: string[]) => void, list: string[], i: number, v: string) {
    setter(list.map((item, idx) => idx === i ? v : item));
  }

  function addStep() { setWorkflowSteps([...workflowSteps, emptyStep()]); }
  function removeStep(i: number) { if (workflowSteps.length > 1) setWorkflowSteps(workflowSteps.filter((_, idx) => idx !== i)); }
  function updateStep(i: number, k: keyof WorkflowStep, v: string) {
    setWorkflowSteps(workflowSteps.map((s, idx) => idx === i ? { ...s, [k]: v } : s));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        category: category.trim() || undefined,
        legalBasis: legalBasis.trim() || undefined,
        waitingPeriodDays: parseInt(waitingPeriodDays, 10) || undefined,
        fundSources: fundSources.map(s => s.trim()).filter(Boolean),
        requiredDocuments: requiredDocuments.map(s => s.trim()).filter(Boolean),
        approvalWorkflow: workflowSteps
          .filter(s => s.stepName.trim() && s.approverRole.trim())
          .map((s, idx) => ({
            stepName: s.stepName.trim(),
            approverRole: s.approverRole.trim(),
            slaDays: parseInt(s.slaDays, 10) || 3,
            order: idx,
          })),
        isActive: true,
      };
      await api.post('/programs', payload);
      toast.success(t('programs.created', 'Program created'), { description: t('programs.createdDesc', 'New program has been added.') });
      globalMutate(queryKeys.programs.list());
      navigate('/admin/programs');
    } catch (err: any) {
      toast.error(t('programs.createFailed', 'Failed to create program'), { description: err.message || t('programs.checkInput', 'Please check your input and try again.') });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell
      title={t('programs.newTitle', 'New Program')}
      description={t('programs.newDescription', 'Define a support program implemented under law')}
      backTo={{ label: t('programs.title', 'Programs'), onClick: () => navigate('/admin/programs') }}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Program identity + legal basis */}
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <div className="border-b bg-muted/30 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Scale size={14} className="text-accent" /> {t('programs.programInfo', 'Program Info & Legal Basis')}
            </h2>
          </div>
          <div className="p-4 space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">{t('programs.programName', 'Program Name *')}</label>
              <Input required value={name} onChange={e => setName(e.target.value)} placeholder={t('programs.namePlaceholder', 'e.g. Medical Assistance Program')} className="h-9" aria-label={t('programs.programName', 'Program Name')} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">{t('programs.category', 'Category *')}</label>
                <Input required value={category} onChange={e => setCategory(e.target.value)} placeholder={t('programs.categoryPlaceholder', 'e.g. Medical, Livelihood, Child Welfare')} className="h-9" aria-label={t('programs.category', 'Category')} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">{t('programs.waitingPeriod', 'Waiting Period (days)')}</label>
                <Input type="number" min={0} value={waitingPeriodDays} onChange={e => setWaitingPeriodDays(e.target.value)} className="h-9" aria-label={t('programs.waitingPeriod', 'Waiting Period (days)')} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">{t('programs.legalBasis', 'Legal Basis / Law *')}</label>
              <textarea
                required
                value={legalBasis}
                onChange={e => setLegalBasis(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y min-h-[60px]"
                placeholder={t('programs.legalBasisPlaceholder', 'e.g. RA 11223 (Universal Health Care Act); DSWD MC No. 5 s.2021 (AICS Guidelines)')}
                aria-label={t('programs.legalBasis', 'Legal Basis / Law')}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Fund Sources */}
          <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
            <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
              <Coins size={14} className="text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">{t('programs.fundSources', 'Fund Sources')}</h2>
              <button type="button" onClick={() => addList(setFundSources, fundSources)} className="ml-auto text-muted-foreground hover:text-foreground" aria-label={t('programs.addFundSource', 'Add fund source')}>
                <Plus size={16} />
              </button>
            </div>
            <div className="p-3 space-y-2 max-h-[300px] overflow-y-auto">
              {fundSources.map((f, i) => (
                <div key={i} className="rounded-md border bg-muted/20 p-2 flex items-center gap-2">
                  <Input value={f} onChange={e => updateList(setFundSources, fundSources, i, e.target.value)} placeholder={t('programs.fundSourcePlaceholder', 'e.g. DSWD - AICS, LGU - Municipal')} className="h-8 text-xs" aria-label={t('programs.fundSourceAria', 'Fund source {{n}}', { n: i + 1 })} />
                  {fundSources.length > 1 && (
                    <button type="button" onClick={() => removeList(setFundSources, fundSources, i)} className="text-muted-foreground hover:text-red-500 shrink-0" aria-label={t('programs.removeFundSource', 'Remove fund source {{n}}', { n: i + 1 })}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Required Documents */}
          <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
            <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
              <FileText size={14} className="text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">{t('programs.requiredDocuments', 'Required Documents')}</h2>
              <button type="button" onClick={() => addList(setRequiredDocuments, requiredDocuments)} className="ml-auto text-muted-foreground hover:text-foreground" aria-label={t('programs.addDocument', 'Add document')}>
                <Plus size={16} />
              </button>
            </div>
            <div className="p-3 space-y-2 max-h-[300px] overflow-y-auto">
              {requiredDocuments.map((d, i) => (
                <div key={i} className="rounded-md border bg-muted/20 p-2 flex items-center gap-2">
                  <Input value={d} onChange={e => updateList(setRequiredDocuments, requiredDocuments, i, e.target.value)} placeholder={t('programs.documentPlaceholder', 'e.g. Barangay Certificate of Indigency')} className="h-8 text-xs" aria-label={t('programs.documentAria', 'Required document {{n}}', { n: i + 1 })} />
                  {requiredDocuments.length > 1 && (
                    <button type="button" onClick={() => removeList(setRequiredDocuments, requiredDocuments, i)} className="text-muted-foreground hover:text-red-500 shrink-0" aria-label={t('programs.removeDocument', 'Remove document {{n}}', { n: i + 1 })}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Approval Workflow */}
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
            <Landmark size={14} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">{t('programs.approvalWorkflow', 'Approval Workflow')}</h2>
            <button type="button" onClick={addStep} className="ml-auto text-muted-foreground hover:text-foreground" aria-label={t('programs.addStep', 'Add approval step')}>
              <Plus size={16} />
            </button>
          </div>
          <div className="p-3 space-y-2">
            {workflowSteps.map((s, i) => (
              <div key={i} className="rounded-md border bg-muted/20 p-3 space-y-2 relative">
                <div className="flex items-center gap-2">
                  <ArrowRight size={12} className="text-muted-foreground shrink-0" />
                  <Input required value={s.stepName} onChange={e => updateStep(i, 'stepName', e.target.value)} placeholder={t('programs.stepTitle', 'Step title (e.g. Approve)')} className="h-8 text-xs" aria-label={t('programs.stepTitleAria', 'Step {{n}} title', { n: i + 1 })} />
                  {workflowSteps.length > 1 && (
                    <button type="button" onClick={() => removeStep(i)} className="text-muted-foreground hover:text-red-500 shrink-0" aria-label={t('programs.removeStepAria', 'Remove step {{n}}', { n: i + 1 })}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={s.approverRole}
                    onChange={e => updateStep(i, 'approverRole', e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    aria-label={t('programs.approverRoleAria', 'Step {{n}} approver role', { n: i + 1 })}
                  >
                    <option value="">{t('programs.selectRole', 'Approver role...')}</option>
                    {APPROVER_ROLES.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{t('programs.slaDays', 'SLA days')}</span>
                    <Input type="number" min={1} value={s.slaDays} onChange={e => updateStep(i, 'slaDays', e.target.value)} className="h-8 text-xs" aria-label={t('programs.slaDaysAria', 'Step {{n}} SLA days', { n: i + 1 })} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <Button type="submit" disabled={submitting} aria-label={t('programs.createProgram', 'Create Program')}>
            {submitting ? t('programs.creating', 'Creating...') : t('programs.createProgram', 'Create Program')}
          </Button>
          <Button variant="outline" onClick={() => navigate('/admin/programs')}>{t('programs.cancel', 'Cancel')}</Button>
        </div>
      </form>
    </PageShell>
  );
}
