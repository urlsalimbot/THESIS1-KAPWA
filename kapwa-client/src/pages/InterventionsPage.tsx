import React, { useState, useEffect } from 'react';
import '../index.css';
import { getInterventions, createIntervention, uploadSignature, uploadReceipt, dataURItoBlob } from '../lib/api';
import SignaturePad from '../components/forms/SignaturePad';

interface Intervention {
  id: string;
  caseId: string;
  beneficiary: string;
  type: string;
  description: string;
  provider: string;
  date: string;
  verified: boolean;
  signatureStatus?: string;
  clientReceiptUrl?: string;
}

export function InterventionsPage() {
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({
    caseId: '', type: '', description: '', provider: '',
    amount: '', agency: '', fundSource: 'Regular',
  });
  const [sigDataUrl, setSigDataUrl] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const data = await getInterventions();
      const mapped: Intervention[] = (data || []).map((i: Record<string, unknown>) => {
        const beneficiary = (i.case as Record<string, unknown>)?.beneficiary as Record<string, unknown> || {};
        return {
          id: i.id as string,
          caseId: i.caseId as string || '',
          beneficiary: beneficiary.firstName && beneficiary.surname ? `${beneficiary.firstName} ${beneficiary.surname}` : '',
          type: i.interventionType as string || '',
          description: `${i.fundSource as string || ''} - ₱${i.amount || 0}`,
          provider: i.agency as string || 'MSWDO',
          date: i.serviceDate ? new Date(i.serviceDate as string).toLocaleDateString() : '',
          verified: !!i.workerSignatureUrl,
          signatureStatus: i.signatureStatus as string | undefined,
          clientReceiptUrl: i.clientReceiptUrl as string | undefined,
        };
      });
      setInterventions(mapped);
    } catch {
      setInterventions([]);
    }
    setLoading(false);
  }

  function update(field: string, value: string) { setForm({ ...form, [field]: value }); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      let workerSignatureUrl = '';
      let receiptUrl = '';

      // Upload signature if captured
      if (sigDataUrl) {
        const blob = dataURItoBlob(sigDataUrl);
        workerSignatureUrl = await uploadSignature(blob, `sig-${Date.now()}.png`);
      }

      // Upload receipt if selected
      if (receiptFile) {
        receiptUrl = await uploadReceipt(receiptFile, receiptFile.name);
      }

      await createIntervention({
        caseId: form.caseId,
        interventionType: form.type,
        amount: parseFloat(form.amount) || 0,
        fundSource: form.fundSource,
        agency: form.agency || 'MSWDO',
        workerSignatureUrl: workerSignatureUrl || undefined,
        clientReceiptUrl: receiptUrl || undefined,
      } as any);

      setShowForm(false);
      setForm({ caseId: '', type: '', description: '', provider: '', amount: '', agency: '', fundSource: 'Regular' });
      setSigDataUrl(null);
      setReceiptFile(null);
      load();
    } catch (err: any) {
      setError(err.message || 'Failed to create intervention');
    }
    setSubmitting(false);
  }

  if (loading) return <div className="p-8 text-center text-style-body">Loading interventions...</div>;

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Interventions</h2>
        <p className="page-desc">Post-disbursement intervention logging (case must be disbursed)</p>
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)} aria-label="+ New Intervention">+ New Intervention</button>
        </div>
      </div>

      {showForm && (
        <div className="card mb-4 max-w-2xl">
          <h3 className="font-heading font-semibold mb-4">Log Intervention</h3>
          {error && <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Case ID (must be disbursed)</label>
                <input className="form-input" required placeholder="Case UUID" value={form.caseId} onChange={e => update('caseId', e.target.value)} aria-label="Case ID" />
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-select" required value={form.type} onChange={e => update('type', e.target.value)} aria-label="Intervention Type">
                  <option value="">Select...</option>
                  <option value="FA">Financial Assistance</option>
                  <option value="C">Counseling</option>
                  <option value="CSR">CSR</option>
                  <option value="R">Referral</option>
                  <option value="H">Healthcare</option>
                  <option value="HV">Home Visit</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Amount (₱)</label>
                <input className="form-input" type="number" min="0" step="0.01" value={form.amount} onChange={e => update('amount', e.target.value)} aria-label="Amount" />
              </div>
              <div className="form-group">
                <label className="form-label">Fund Source</label>
                <select className="form-select" value={form.fundSource} onChange={e => update('fundSource', e.target.value)} aria-label="Fund Source">
                  <option value="Regular">Regular</option>
                  <option value="PDAF">PDAF</option>
                  <option value="Legislative">Legislative</option>
                  <option value="Donation">Donation</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Agency</label>
              <input className="form-input" value={form.agency} placeholder="MSWDO" onChange={e => update('agency', e.target.value)} aria-label="Agency" />
            </div>
            <div className="form-group">
              <SignaturePad
                onSave={(dataUrl: string) => setSigDataUrl(dataUrl)}
                label="Worker Signature"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Client Receipt (optional photo)</label>
              <input
                type="file"
                accept="image/*"
                className="form-input"
                onChange={e => setReceiptFile(e.target.files?.[0] || null)}
                aria-label="Client Receipt"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary" disabled={submitting} aria-label="Log Intervention">
                {submitting ? 'Saving...' : 'Log Intervention'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setError(''); setSigDataUrl(null); setReceiptFile(null); }} aria-label="Cancel">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Case ID</th>
              <th>Beneficiary</th>
              <th>Type</th>
              <th>Description</th>
              <th>Provider</th>
              <th>Date</th>
              <th>Signature</th>
              <th>Receipt</th>
            </tr>
          </thead>
          <tbody>
            {interventions.map(i => (
              <tr key={i.id}>
                <td className="font-medium">{i.id}</td>
                <td>{i.caseId}</td>
                <td>{i.beneficiary}</td>
                <td><span className="badge-category">{i.type}</span></td>
                <td>{i.description}</td>
                <td>{i.provider}</td>
                <td>{i.date}</td>
                <td>
                  {i.signatureStatus === 'signatures_pending'
                    ? <span className="badge-pending">Signatures Pending</span>
                    : i.verified
                      ? <span className="badge-approved">✓ Signed</span>
                      : <span className="badge-pending">Pending</span>}
                </td>
                <td>
                  {i.clientReceiptUrl
                    ? <a href={i.clientReceiptUrl} target="_blank" rel="noopener noreferrer" className="text-[#2E5C8A] underline text-sm">View Receipt</a>
                    : <span className="text-gray-400 text-sm">None</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
