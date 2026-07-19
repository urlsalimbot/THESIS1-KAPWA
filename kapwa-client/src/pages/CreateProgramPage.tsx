import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSWRConfig } from 'swr';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Plus, Trash2, FileText, ClipboardList, ArrowRight, Users, Activity } from 'lucide-react';

interface Step { title: string; description: string; }
interface Requirement { item: string; quantity: string; }

const emptyStep = (): Step => ({ title: '', description: '' });
const emptyReq = (): Requirement => ({ item: '', quantity: '' });

export function CreateProgramPage() {
  const navigate = useNavigate();
  const { mutate: globalMutate } = useSWRConfig();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [workflowSteps, setWorkflowSteps] = useState<Step[]>([emptyStep()]);
  const [requirements, setRequirements] = useState<Requirement[]>([emptyReq()]);
  const [submitting, setSubmitting] = useState(false);

  function addStep() { setWorkflowSteps([...workflowSteps, emptyStep()]); }
  function removeStep(i: number) { if (workflowSteps.length > 1) setWorkflowSteps(workflowSteps.filter((_, idx) => idx !== i)); }
  function updateStep(i: number, k: keyof Step, v: string) {
    setWorkflowSteps(workflowSteps.map((s, idx) => idx === i ? { ...s, [k]: v } : s));
  }

  function addReq() { setRequirements([...requirements, emptyReq()]); }
  function removeReq(i: number) { if (requirements.length > 1) setRequirements(requirements.filter((_, idx) => idx !== i)); }
  function updateReq(i: number, k: keyof Requirement, v: string) {
    setRequirements(requirements.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/programs', {
        name, description, status: 'Active', programType: 'Regular',
        workflowSteps: workflowSteps.filter(s => s.title.trim()),
        requirements: requirements.filter(r => r.item.trim()),
      });
      toast.success('Program created successfully');
      globalMutate(queryKeys.programs.list());
      navigate('/programs');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create program');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell
      title="New Program"
      description="Define a rehabilitation or support program for clients"
      backTo={{ label: 'Programs', onClick: () => navigate('/programs') }}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Program identity */}
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <div className="border-b bg-muted/30 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Activity size={14} className="text-accent" /> Program Info
            </h2>
          </div>
          <div className="p-4 space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Program Name *</label>
              <Input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Reintegration Support Program" className="h-9" aria-label="Program Name" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Description *</label>
              <textarea
                required
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y min-h-[80px]"
                placeholder="What is this program designed to achieve?"
                aria-label="Description"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Workflow Steps */}
          <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
            <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
              <ClipboardList size={14} className="text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Workflow Steps</h2>
              <button type="button" onClick={addStep} className="ml-auto text-muted-foreground hover:text-foreground" aria-label="Add step">
                <Plus size={16} />
              </button>
            </div>
            <div className="p-3 space-y-2 max-h-[360px] overflow-y-auto">
              {workflowSteps.map((s, i) => (
                <div key={i} className="rounded-md border bg-muted/20 p-3 space-y-2 relative">
                  <div className="flex items-center gap-2">
                    <ArrowRight size={12} className="text-muted-foreground shrink-0" />
                    <Input required value={s.title} onChange={e => updateStep(i, 'title', e.target.value)} placeholder="Step title" className="h-8 text-xs" aria-label={`Step ${i + 1} title`} />
                    {workflowSteps.length > 1 && (
                      <button type="button" onClick={() => removeStep(i)} className="text-muted-foreground hover:text-red-500 shrink-0" aria-label={`Remove step ${i + 1}`}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <textarea
                    value={s.description}
                    onChange={e => updateStep(i, 'description', e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y min-h-[48px]"
                    placeholder="Description of this step"
                    aria-label={`Step ${i + 1} description`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Requirements */}
          <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
            <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
              <FileText size={14} className="text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Requirements</h2>
              <button type="button" onClick={addReq} className="ml-auto text-muted-foreground hover:text-foreground" aria-label="Add requirement">
                <Plus size={16} />
              </button>
            </div>
            <div className="p-3 space-y-2 max-h-[360px] overflow-y-auto">
              {requirements.map((r, i) => (
                <div key={i} className="rounded-md border bg-muted/20 p-3 flex items-center gap-2">
                  <div className="flex-1">
                    <Input required value={r.item} onChange={e => updateReq(i, 'item', e.target.value)} placeholder="Requirement" className="h-8 text-xs" aria-label={`Requirement ${i + 1} item`} />
                  </div>
                  <div className="w-24 shrink-0">
                    <Input value={r.quantity} onChange={e => updateReq(i, 'quantity', e.target.value)} placeholder="Qty" className="h-8 text-xs" aria-label={`Requirement ${i + 1} quantity`} />
                  </div>
                  {requirements.length > 1 && (
                    <button type="button" onClick={() => removeReq(i)} className="text-muted-foreground hover:text-red-500 shrink-0" aria-label={`Remove requirement ${i + 1}`}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <Button type="submit" disabled={submitting} aria-label="Create Program">
            {submitting ? 'Creating...' : 'Create Program'}
          </Button>
          <Button variant="outline" onClick={() => navigate('/programs')}>Cancel</Button>
        </div>
      </form>
    </PageShell>
  );
}
