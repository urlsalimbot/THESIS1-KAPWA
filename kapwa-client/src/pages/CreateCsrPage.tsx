import { useState } from 'react';
import { useSWRConfig } from 'swr';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, User, Building, MapPin, Users, Target, BookOpen, ChartBar, ClipboardCheck, Lightbulb, Route } from 'lucide-react';

interface CsrForm {
  caseId: string; socialWorkerName: string; socialWorkerPosition: string;
  referralOrigin: string; reasonForReferral: string; problemPresented: string;
  familyBackground: string; socioEconomicProfile: string; assessmentAnalysis: string;
  recommendation: string; interventionPlan: string; finalized: boolean;
}

const emptyForm: CsrForm = {
  caseId: '', socialWorkerName: '', socialWorkerPosition: '', referralOrigin: '',
  reasonForReferral: '', problemPresented: '', familyBackground: '',
  socioEconomicProfile: '', assessmentAnalysis: '', recommendation: '',
  interventionPlan: '', finalized: false,
};

const SECTIONS = [
  { key: 'reasonForReferral', label: 'Reason for Referral', icon: Target },
  { key: 'problemPresented', label: 'Problem Presented', icon: ClipboardCheck },
  { key: 'familyBackground', label: 'Family Background', icon: Users },
  { key: 'socioEconomicProfile', label: 'Socio-Economic Profile', icon: ChartBar },
  { key: 'assessmentAnalysis', label: 'Assessment & Analysis', icon: BookOpen },
  { key: 'recommendation', label: 'Recommendation', icon: Lightbulb },
  { key: 'interventionPlan', label: 'Intervention Plan', icon: Route },
] as const;

export function CreateCsrPage() {
  const { mutate: globalMutate } = useSWRConfig();
  const navigate = useNavigate();
  const [form, setForm] = useState<CsrForm>(emptyForm);
  const [msg, setMsg] = useState('');

  function update(field: keyof CsrForm, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    try {
      await api.post('/csr', form as unknown as Record<string, unknown>);
      globalMutate(queryKeys.csr.list());
      navigate('/csr');
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Error creating CSR');
    }
  }

  return (
    <PageShell title="Create CSR Report" description="Family Case Study Report — MSWDO Norzagaray">
      {msg && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{msg}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Case Reference — compact header */}
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <div className="border-b bg-muted/30 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-foreground">Case Reference</h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr] gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <FileText size={12} /> Case ID *
                </label>
                <Input required value={form.caseId} onChange={e => update('caseId', e.target.value)} placeholder="Paste case UUID" className="h-9" aria-label="Case ID" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <User size={12} /> Social Worker *
                </label>
                <Input required value={form.socialWorkerName} onChange={e => update('socialWorkerName', e.target.value)} className="h-9" aria-label="Social Worker" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <Building size={12} /> Position
                </label>
                <Input value={form.socialWorkerPosition} onChange={e => update('socialWorkerPosition', e.target.value)} placeholder="e.g. SWO I" className="h-9" aria-label="Social Worker Position" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <MapPin size={12} /> Referral Origin
                </label>
                <Input value={form.referralOrigin} onChange={e => update('referralOrigin', e.target.value)} placeholder="Barangay / Agency" className="h-9" aria-label="Referral Origin" />
              </div>
            </div>
          </div>
        </div>

        {/* Narrative sections — 2-col grid on wide screens */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {SECTIONS.map(s => {
            const Icon = s.icon;
            return (
              <div key={s.key} className="rounded-lg border bg-card shadow-sm overflow-hidden">
                <div className="border-b bg-muted/30 px-4 py-2 flex items-center gap-2">
                  <Icon size={14} className="text-muted-foreground" />
                  <h3 className="text-xs font-semibold text-foreground">{s.label}</h3>
                </div>
                <div className="p-3">
                  <textarea
                    value={form[s.key] as string}
                    onChange={e => update(s.key, e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y min-h-[140px]"
                    aria-label={s.label}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Finalized + Actions */}
        <div className="rounded-lg border bg-card shadow-sm p-4 flex items-center justify-between gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.finalized} onChange={e => update('finalized', e.target.checked)} className="rounded border-gray-300 text-primary" aria-label="Finalized" />
            Mark report as finalized
          </label>
          <div className="flex gap-2">
            <Button type="submit" aria-label="Create CSR">Create CSR</Button>
            <Button type="button" variant="outline" onClick={() => navigate('/csr')}>Cancel</Button>
          </div>
        </div>
      </form>
    </PageShell>
  );
}
