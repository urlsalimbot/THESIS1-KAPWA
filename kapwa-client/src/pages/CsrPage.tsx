import React, { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import { getCsrRecords, createCsrRecord, updateCsrRecord, deleteCsrRecord, downloadCsrPdf } from '../lib/api';
import '../index.css';

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
  const [records, setRecords] = useState<CsrRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CsrForm>(emptyForm);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => { const ac = new AbortController(); load(ac.signal); return () => ac.abort(); }, []);

  async function load(signal?: AbortSignal) {
    setLoading(true);
    try {
      const data = await getCsrRecords(signal);
      setRecords(data || []);
    } catch { setRecords([]); }
    setLoading(false);
  }

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
        await updateCsrRecord(editingId, form as unknown as Record<string, unknown>);
        setMsg('CSR updated');
      } else {
        await createCsrRecord(form as unknown as Record<string, unknown>);
        setMsg('CSR created');
      }
      setShowForm(false);
      load();
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Error saving CSR');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this CSR record?')) return;
    await deleteCsrRecord(id);
    load();
  }

  async function handleFinalize(id: string, finalized: boolean) {
    await updateCsrRecord(id, { finalized });
    load();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">CSR Generator</h2>
          <p className="page-desc">Family Case Study Reports — MSWDO Norzagaray</p>
        </div>
      </div>

      {msg && <div className="mb-4 rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">{msg}</div>}

      <div className="toolbar">
        <div className="toolbar-left">
          <button className="btn btn-primary" onClick={openNew} aria-label="+ New CSR">+ New CSR</button>
        </div>
        <div className="toolbar-right">
          <input type="text" placeholder="Search CSR..." className="form-input max-w-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} aria-label="Search CSR" />
        </div>
      </div>

      {showForm && (
        <div className="card mb-6 max-w-4xl">
          <h3 className="font-heading font-semibold mb-4">{editingId ? 'Edit CSR' : 'New CSR Report'}</h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h4 className="mb-3 text-sm font-semibold text-primary">I. Case Reference</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="form-group">
                  <label className="form-label">Case ID *</label>
                  <input className="form-input" required value={form.caseId} onChange={e => updateForm('caseId', e.target.value)} placeholder="Case UUID" aria-label="Case ID" />
                </div>
                <div className="form-group">
                  <label className="form-label">Social Worker *</label>
                  <input className="form-input" required value={form.socialWorkerName} onChange={e => updateForm('socialWorkerName', e.target.value)} aria-label="Social Worker" />
                </div>
                <div className="form-group">
                  <label className="form-label">Position</label>
                  <input className="form-input" value={form.socialWorkerPosition} onChange={e => updateForm('socialWorkerPosition', e.target.value)} placeholder="e.g. SWO I" aria-label="Social Worker Position" />
                </div>
              </div>
              <div className="form-group mt-3">
                <label className="form-label">Referral Origin</label>
                <input className="form-input" value={form.referralOrigin} onChange={e => updateForm('referralOrigin', e.target.value)} placeholder="Barangay / Agency / Self" aria-label="Referral Origin" />
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h4 className="mb-3 text-sm font-semibold text-primary">II. Reason for Referral</h4>
              <textarea className="form-input min-h-[80px]" value={form.reasonForReferral} onChange={e => updateForm('reasonForReferral', e.target.value)} placeholder="Why was the client referred to MSWDO?" aria-label="Reason for Referral" />
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h4 className="mb-3 text-sm font-semibold text-primary">III. Problem Presented</h4>
              <textarea className="form-input min-h-[80px]" value={form.problemPresented} onChange={e => updateForm('problemPresented', e.target.value)} placeholder="Describe the presenting problem" aria-label="Problem Presented" />
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h4 className="mb-3 text-sm font-semibold text-primary">IV. Family Background</h4>
              <textarea className="form-input min-h-[100px]" value={form.familyBackground} onChange={e => updateForm('familyBackground', e.target.value)} placeholder="Family structure, relationships, history" aria-label="Family Background" />
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h4 className="mb-3 text-sm font-semibold text-primary">V. Socio-Economic Profile</h4>
              <textarea className="form-input min-h-[80px]" value={form.socioEconomicProfile} onChange={e => updateForm('socioEconomicProfile', e.target.value)} placeholder="Income, employment, housing, education" aria-label="Socio-Economic Profile" />
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h4 className="mb-3 text-sm font-semibold text-primary">VI. Assessment & Analysis</h4>
<textarea className="form-input min-h-[100px]" value={form.assessmentAnalysis} onChange={e => updateForm('assessmentAnalysis', e.target.value)} placeholder="Social worker's assessment and professional analysis" aria-label="Assessment and Analysis" />
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h4 className="mb-3 text-sm font-semibold text-primary">VII. Recommendation</h4>
              <textarea className="form-input min-h-[80px]" value={form.recommendation} onChange={e => updateForm('recommendation', e.target.value)} placeholder="Recommended course of action" aria-label="Recommendation" />
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h4 className="mb-3 text-sm font-semibold text-primary">VIII. Intervention Plan</h4>
              <textarea className="form-input min-h-[80px]" value={form.interventionPlan} onChange={e => updateForm('interventionPlan', e.target.value)} placeholder="Planned interventions and services" aria-label="Intervention Plan" />
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.finalized} onChange={e => updateForm('finalized', e.target.checked)} className="rounded border-gray-300 text-primary" aria-label="Finalized" />
                Mark as finalized
              </label>
            </div>

            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary" aria-label="Create CSR">{editingId ? 'Update CSR' : 'Create CSR'}</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)} aria-label="Cancel">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading CSR records...</div>
      ) : records.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <FileText className="mx-auto mb-2" size={32} />
          <p>No CSR records yet. Create your first Family Case Study Report.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.filter(r => !searchTerm || r.controlNo?.toLowerCase().includes(searchTerm.toLowerCase()) || r.socialWorkerName?.toLowerCase().includes(searchTerm.toLowerCase())).map(r => (
            <div key={r.id} className="card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${r.finalized ? 'bg-green-500' : 'bg-amber-400'}`} />
                  <div>
                    <span className="font-mono font-semibold text-primary">{r.controlNo}</span>
                    <span className="ml-2 text-xs text-gray-400">| {new Date(r.createdAt).toLocaleDateString('en-PH')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{r.socialWorkerName}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${r.finalized ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {r.finalized ? 'Finalized' : 'Draft'}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button onClick={() => setExpandedId(expandedId === r.id ? null : r.id)} className="btn-text btn-text-sm" aria-label="View Details">
                  {expandedId === r.id ? 'Collapse' : 'View Details'}
                </button>
                <button onClick={() => downloadCsrPdf(r.controlNo)} className="btn-text btn-text-sm" aria-label="Download PDF">
                  Download PDF
                </button>
                <button onClick={() => openEdit(r)} className="btn-text btn-text-sm" aria-label="Edit">Edit</button>
                <button onClick={() => handleFinalize(r.id, !r.finalized)} className="btn-text btn-text-sm" aria-label="Finalize">
                  {r.finalized ? 'Unfinalize' : 'Finalize'}
                </button>
                <button onClick={() => handleDelete(r.id)} className="btn-text btn-text-sm text-red-600" aria-label="Delete">Delete</button>
              </div>
              {expandedId === r.id && (
                <div className="mt-4 border-t border-gray-100 pt-4 text-sm space-y-3">
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const Section = React.memo(function Section({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-xs font-semibold text-gray-500">{label}</span>
      <p className="text-gray-700 whitespace-pre-wrap">{value}</p>
    </div>
  );
});
