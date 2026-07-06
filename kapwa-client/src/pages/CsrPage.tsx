import React, { useState } from 'react';
import { useSWRConfig } from 'swr';
import useSWR from 'swr';
import { FileText } from 'lucide-react';
import { api, downloadCsrPdf } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { CardGridSkeleton } from '@/components/skeletons/CardGridSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CsrRecord {
  id: string; caseId: string; controlNo: string; socialWorkerName: string;
  socialWorkerPosition: string; referralOrigin: string; reasonForReferral: string;
  problemPresented: string; familyBackground: string; socioEconomicProfile: string;
  assessmentAnalysis: string; recommendation: string; interventionPlan: string;
  clientSignatureUrl: string; workerSignatureUrl: string; finalized: boolean;
  createdBy: string; createdAt: string; updatedAt: string;
}

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

export function CsrPage() {
  const { mutate: globalMutate } = useSWRConfig();
  const { data: records = [], isLoading: loading } = useSWR<CsrRecord[]>(queryKeys.csr.list());
  const lastSync = records.length > 0 ? Date.now() : null;

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CsrForm>(emptyForm);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [msg, setMsg] = useState('');

  function openNew() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(r: CsrRecord) {
    setForm({
      caseId: r.caseId, socialWorkerName: r.socialWorkerName,
      socialWorkerPosition: r.socialWorkerPosition || '', referralOrigin: r.referralOrigin || '',
      reasonForReferral: r.reasonForReferral || '', problemPresented: r.problemPresented || '',
      familyBackground: r.familyBackground || '', socioEconomicProfile: r.socioEconomicProfile || '',
      assessmentAnalysis: r.assessmentAnalysis || '', recommendation: r.recommendation || '',
      interventionPlan: r.interventionPlan || '', finalized: r.finalized,
    });
    setEditingId(r.id);
    setShowForm(true);
  }

  function updateForm(field: keyof CsrForm, value: string | number | boolean | string[]) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    try {
      if (editingId) {
        await api.put(`/csr/${editingId}`, form as unknown as Record<string, unknown>);
        setMsg('CSR updated');
      } else {
        await api.post('/csr', form as unknown as Record<string, unknown>);
        setMsg('CSR created');
      }
      setShowForm(false);
      globalMutate(queryKeys.csr.list());
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Error saving CSR');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this CSR record?')) return;
    await api.del(`/csr/${id}`);
    globalMutate(queryKeys.csr.list());
  }

  async function handleFinalize(id: string, finalized: boolean) {
    await api.put(`/csr/${id}`, { finalized });
    globalMutate(queryKeys.csr.list());
  }

  if (loading) {
    return (
      <PageShell title="CSR Generator" description="Family Case Study Reports — MSWDO Norzagaray">
        <CardGridSkeleton count={3} />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="CSR Generator"
      description="Family Case Study Reports — MSWDO Norzagaray"
      cachedAt={lastSync ?? undefined}
    >
      {/* Message banner */}
      {msg && <div className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">{msg}</div>}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="default" onClick={openNew} aria-label="+ New CSR">+ New CSR</Button>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="text"
            placeholder="Search CSR..."
            className="w-48"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            aria-label="Search CSR"
          />
        </div>
      </div>

      {/* New/Edit Form */}
      {showForm && (
        <Card className="max-w-4xl">
          <CardHeader>
            <CardTitle>{editingId ? 'Edit CSR' : 'New CSR Report'}</CardTitle>
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
                <Button type="submit" aria-label="Create CSR">{editingId ? 'Update CSR' : 'Create CSR'}</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)} aria-label="Cancel">Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Records list */}
      {!loading && records.length === 0 ? (
        <EmptyState variant={searchTerm ? 'no-results' : 'no-data'} />
      ) : (
        <div className="space-y-3">
          {records.filter(r => !searchTerm || r.controlNo?.toLowerCase().includes(searchTerm.toLowerCase()) || r.socialWorkerName?.toLowerCase().includes(searchTerm.toLowerCase())).map(r => (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full ${r.finalized ? 'bg-green-500' : 'bg-amber-400'}`} />
                    <div>
                      <span className="font-mono font-semibold text-primary">{r.controlNo}</span>
                      <span className="ml-2 text-xs text-muted-foreground">| {new Date(r.createdAt).toLocaleDateString('en-PH')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{r.socialWorkerName}</span>
                    <Badge variant={r.finalized ? 'default' : 'secondary'}>
                      {r.finalized ? 'Finalized' : 'Draft'}
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setExpandedId(expandedId === r.id ? null : r.id)} aria-label="View Details">
                    {expandedId === r.id ? 'Collapse' : 'View Details'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => downloadCsrPdf(r.controlNo)} aria-label="Download PDF">
                    Download PDF
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(r)} aria-label="Edit">Edit</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleFinalize(r.id, !r.finalized)} aria-label="Finalize">
                    {r.finalized ? 'Unfinalize' : 'Finalize'}
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(r.id)} aria-label="Delete">Delete</Button>
                </div>
                {expandedId === r.id && (
                  <div className="mt-4 border-t border-border pt-4 text-sm space-y-3">
                    <Section label="Case ID" value={r.caseId} />
                    <Section label="Social Worker" value={`${r.socialWorkerName}${r.socialWorkerPosition ? ` — ${r.socialWorkerPosition}` : ''}`} />
                    <Section label="Referral" value={r.referralOrigin} />
                    <Section label="Reason for Referral" value={r.reasonForReferral} />
                    <Section label="Problem Presented" value={r.problemPresented} />
                    <Section label="Family Background" value={r.familyBackground} />
                    <Section label="Socio-Economic Profile" value={r.socioEconomicProfile} />
                    <Section label="Assessment & Analysis" value={r.assessmentAnalysis} />
                    <Section label="Recommendation" value={r.recommendation} />
                    <Section label="Intervention Plan" value={r.interventionPlan} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Print layout (hidden on screen) */}
      <div className="hidden print:block print-header">
        <div className="text-center mb-6">
          <h2 className="text-lg font-bold">MSWDO Norzagaray</h2>
          <p className="text-sm">Municipal Social Welfare and Development Office</p>
          <p className="text-xs">Norzagaray, Bulacan</p>
        </div>
      </div>
      <div className="hidden print:block print-footer">
        <p className="text-xs text-center">DSWD Seal | RA 11032 | Printed: {new Date().toLocaleDateString()}</p>
      </div>
    </PageShell>
  );
}

const Section = React.memo(function Section({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <p className="text-foreground whitespace-pre-wrap">{value}</p>
    </div>
  );
});
