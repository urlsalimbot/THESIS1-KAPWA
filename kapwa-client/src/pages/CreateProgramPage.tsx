import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/errors';
import {
  ArrowRight, ClipboardList, Coins, FileText, Landmark, Plus, Scale, Trash2,
} from 'lucide-react';

interface WorkflowStep { stepName: string; approverRole: string; slaDays: string; }
const emptyStep = (): WorkflowStep => ({ stepName: '', approverRole: '', slaDays: '3' });

const APPROVER_ROLES = ['admin', 'social_worker', 'coordinator', 'mayor'];

function Section({
  icon, title, action, children, description,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  description?: string;
}) {
  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <header className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2.5">
        <span className="text-accent" aria-hidden="true">{icon}</span>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {action && <div className="ml-auto">{action}</div>}
      </header>
      <div className="space-y-3 p-4">
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        {children}
      </div>
    </section>
  );
}

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

  const canSubmit = Boolean(name.trim() && category.trim() && legalBasis.trim()) && !submitting;

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
      toast.error(t('programs.createFailed', 'Could not create program'), { description: humanizeError(err) });
    } finally {
      setSubmitting(false);
    }
  }

  const addButton = (label: string, onClick: () => void) => (
    <Button type="button" variant="outline" size="sm" onClick={onClick} className="h-8 gap-1.5 text-xs">
      <Plus size={14} aria-hidden="true" /> {label}
    </Button>
  );

  return (
    <PageShell
      title={t('programs.newTitle', 'New Program')}
      description={t('programs.newDescription', 'Define a support program implemented under law')}
      backTo={{ label: t('programs.title', 'Programs'), onClick: () => navigate('/admin/programs') }}
    >
      <form onSubmit={handleSubmit} className="space-y-4 pb-20">
        {/* Program identity + legal basis */}
        <Section
          icon={<Scale size={14} />}
          title={t('programs.programInfo', 'Program Info & Legal Basis')}
          description={t('programs.programInfoHint', 'The public name, the assistance category, and the law or issuance the program is implemented under.')}
        >
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="program-name">{t('programs.programName', 'Program Name *')}</label>
            <Input id="program-name" required value={name} onChange={e => setName(e.target.value)} placeholder={t('programs.namePlaceholder', 'e.g. Medical Assistance Program')} className="h-9" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="program-category">{t('programs.category', 'Category *')}</label>
              <Input id="program-category" required value={category} onChange={e => setCategory(e.target.value)} placeholder={t('programs.categoryPlaceholder', 'e.g. Medical, Livelihood, Child Welfare')} className="h-9" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="program-wait">{t('programs.waitingPeriod', 'Waiting Period (days)')}</label>
              <Input id="program-wait" type="number" min={0} value={waitingPeriodDays} onChange={e => setWaitingPeriodDays(e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="program-legal">{t('programs.legalBasis', 'Legal Basis / Law *')}</label>
            <textarea
              id="program-legal"
              required
              value={legalBasis}
              onChange={e => setLegalBasis(e.target.value)}
              className="min-h-[60px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder={t('programs.legalBasisPlaceholder', 'e.g. RA 11223 (Universal Health Care Act); DSWD MC No. 5 s.2021 (AICS Guidelines)')}
            />
          </div>
        </Section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Fund Sources */}
          <Section
            icon={<Coins size={14} />}
            title={t('programs.fundSources', 'Fund Sources')}
            action={addButton(t('programs.add', 'Add'), () => addList(setFundSources, fundSources))}
          >
            <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
              {fundSources.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input value={f} onChange={e => updateList(setFundSources, fundSources, i, e.target.value)} placeholder={t('programs.fundSourcePlaceholder', 'e.g. DSWD - AICS, LGU - Municipal')} className="h-8 text-xs" aria-label={t('programs.fundSourceAria', 'Fund source {{n}}', { n: i + 1 })} />
                  {fundSources.length > 1 && (
                    <button type="button" onClick={() => removeList(setFundSources, fundSources, i)} className="shrink-0 text-muted-foreground hover:text-destructive" aria-label={t('programs.removeFundSource', 'Remove fund source {{n}}', { n: i + 1 })}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Section>

          {/* Required Documents */}
          <Section
            icon={<FileText size={14} />}
            title={t('programs.requiredDocuments', 'Required Documents')}
            action={addButton(t('programs.add', 'Add'), () => addList(setRequiredDocuments, requiredDocuments))}
          >
            <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
              {requiredDocuments.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input value={d} onChange={e => updateList(setRequiredDocuments, requiredDocuments, i, e.target.value)} placeholder={t('programs.documentPlaceholder', 'e.g. Barangay Certificate of Indigency')} className="h-8 text-xs" aria-label={t('programs.documentAria', 'Required document {{n}}', { n: i + 1 })} />
                  {requiredDocuments.length > 1 && (
                    <button type="button" onClick={() => removeList(setRequiredDocuments, requiredDocuments, i)} className="shrink-0 text-muted-foreground hover:text-destructive" aria-label={t('programs.removeDocument', 'Remove document {{n}}', { n: i + 1 })}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* Approval Workflow */}
        <Section
          icon={<Landmark size={14} />}
          title={t('programs.approvalWorkflow', 'Approval Workflow')}
          description={t('programs.workflowHint', 'Ordered approval steps a case must pass. Each step names the approving role and its service-level agreement in days.')}
          action={addButton(t('programs.addStep', 'Add step'), addStep)}
        >
          <ol className="space-y-2">
            {workflowSteps.map((s, i) => (
              <li key={i} className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
                  <Input required value={s.stepName} onChange={e => updateStep(i, 'stepName', e.target.value)} placeholder={t('programs.stepTitle', 'Step title (e.g. Approve)')} className="h-8 text-xs" aria-label={t('programs.stepTitleAria', 'Step {{n}} title', { n: i + 1 })} />
                  {workflowSteps.length > 1 && (
                    <button type="button" onClick={() => removeStep(i)} className="shrink-0 text-muted-foreground hover:text-destructive" aria-label={t('programs.removeStepAria', 'Remove step {{n}}', { n: i + 1 })}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 pl-8">
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
                  <div className="flex items-center gap-2">
                    <span className="whitespace-nowrap text-xs text-muted-foreground">{t('programs.slaDays', 'SLA days')}</span>
                    <Input type="number" min={1} value={s.slaDays} onChange={e => updateStep(i, 'slaDays', e.target.value)} className="h-8 text-xs" aria-label={t('programs.slaDaysAria', 'Step {{n}} SLA days', { n: i + 1 })} />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        {/* Sticky action bar */}
        <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-5 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <p className="hidden text-xs text-muted-foreground sm:block">
              <ClipboardList size={12} className="mr-1 inline" aria-hidden="true" />
              {t('programs.requiredHint', '* required fields')}
            </p>
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="outline" onClick={() => navigate('/admin/programs')}>{t('programs.cancel', 'Cancel')}</Button>
              <Button type="submit" disabled={!canSubmit} className="gap-1.5">
                {submitting ? t('programs.creating', 'Creating...') : t('programs.createProgram', 'Create Program')}
                {!submitting && <ArrowRight size={14} aria-hidden="true" />}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </PageShell>
  );
}
