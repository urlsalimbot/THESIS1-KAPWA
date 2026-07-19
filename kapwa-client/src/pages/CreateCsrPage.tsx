import { useState } from 'react';
import { useSWRConfig } from 'swr';
import useSWR from 'swr';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

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

export function CreateCsrPage() {
  const { mutate: globalMutate } = useSWRConfig();
  const navigate = useNavigate();
  const [form, setForm] = useState<CsrForm>(emptyForm);
  const [msg, setMsg] = useState('');

  function updateForm(field: keyof CsrForm, value: string | number | boolean | string[]) {
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
    <PageShell title="Create CSR Report" description="Family Case Study Reports — MSWDO Norzagaray">
      {/* Message banner */}
      {msg && <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{msg}</div>}

      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>New CSR Report</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <h4 className="mb-3 text-sm font-semibold text-primary">I. Case Reference</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Case ID *</label>
                  <Input required value={form.caseId} onChange={e => updateForm('caseId', e.target.value)} placeholder="Case UUID" aria-label="Case ID" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Social Worker *</label>
                  <Input required value={form.socialWorkerName} onChange={e => updateForm('socialWorkerName', e.target.value)} aria-label="Social Worker" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Position</label>
                  <Input value={form.socialWorkerPosition} onChange={e => updateForm('socialWorkerPosition', e.target.value)} placeholder="e.g. SWO I" aria-label="Social Worker Position" />
                </div>
              </div>
              <div className="space-y-2 mt-3">
                <label className="text-sm font-medium">Referral Origin</label>
                <Input value={form.referralOrigin} onChange={e => updateForm('referralOrigin', e.target.value)} placeholder="Barangay / Agency / Self" aria-label="Referral Origin" />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <h4 className="mb-3 text-sm font-semibold text-primary">II. Reason for Referral</h4>
              <textarea className="flex h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" value={form.reasonForReferral} onChange={e => updateForm('reasonForReferral', e.target.value)} placeholder="Why was the client referred to MSWDO?" aria-label="Reason for Referral" />
            </div>

            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <h4 className="mb-3 text-sm font-semibold text-primary">III. Problem Presented</h4>
              <textarea className="flex h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" value={form.problemPresented} onChange={e => updateForm('problemPresented', e.target.value)} placeholder="Describe the presenting problem" aria-label="Problem Presented" />
            </div>

            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <h4 className="mb-3 text-sm font-semibold text-primary">IV. Family Background</h4>
              <textarea className="flex h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" value={form.familyBackground} onChange={e => updateForm('familyBackground', e.target.value)} placeholder="Family structure, relationships, history" aria-label="Family Background" />
            </div>

            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <h4 className="mb-3 text-sm font-semibold text-primary">V. Socio-Economic Profile</h4>
              <textarea className="flex h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" value={form.socioEconomicProfile} onChange={e => updateForm('socioEconomicProfile', e.target.value)} placeholder="Income, employment, housing, education" aria-label="Socio-Economic Profile" />
            </div>

            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <h4 className="mb-3 text-sm font-semibold text-primary">VI. Assessment & Analysis</h4>
              <textarea className="flex h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" value={form.assessmentAnalysis} onChange={e => updateForm('assessmentAnalysis', e.target.value)} placeholder="Social worker's assessment and professional analysis" aria-label="Assessment and Analysis" />
            </div>

            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <h4 className="mb-3 text-sm font-semibold text-primary">VII. Recommendation</h4>
              <textarea className="flex h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" value={form.recommendation} onChange={e => updateForm('recommendation', e.target.value)} placeholder="Recommended course of action" aria-label="Recommendation" />
            </div>

            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <h4 className="mb-3 text-sm font-semibold text-primary">VIII. Intervention Plan</h4>
              <textarea className="flex h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" value={form.interventionPlan} onChange={e => updateForm('interventionPlan', e.target.value)} placeholder="Planned interventions and services" aria-label="Intervention Plan" />
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.finalized} onChange={e => updateForm('finalized', e.target.checked)} className="rounded border-gray-300 text-primary" aria-label="Finalized" />
                Mark as finalized
              </label>
            </div>

            <div className="flex gap-2">
              <Button type="submit" aria-label="Create CSR">Create CSR</Button>
              <Button type="button" variant="outline" onClick={() => navigate('/csr')} aria-label="Cancel">Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
