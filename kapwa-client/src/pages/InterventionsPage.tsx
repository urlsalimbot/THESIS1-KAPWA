import React, { useState, useEffect } from 'react';
import '../index.css';
import { getInterventions, createIntervention } from '../lib/api';

interface Intervention { id: string; caseId: string; beneficiary: string; type: string; description: string; provider: string; date: string; verified: boolean; }

export function InterventionsPage() {
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ caseId: '', type: '', description: '', provider: '', workerSignatureUrl: '' });

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const data = await getInterventions();
      const mapped: Intervention[] = (data || []).map((i: any) => ({
        id: i.id,
        caseId: i.caseId || '',
        beneficiary: i.case?.beneficiary ? `${i.case.beneficiary.firstName} ${i.case.beneficiary.surname}` : '',
        type: i.interventionType || '',
        description: `${i.fundSource || ''} - ₱${i.amount || 0}`,
        provider: i.agency || 'MSWDO',
        date: i.serviceDate ? new Date(i.serviceDate).toLocaleDateString() : '',
        verified: !!i.workerSignatureUrl,
      }));
      setInterventions(mapped);
    } catch {
      setInterventions([]);
    }
    setLoading(false);
  }

  function update(field: string, value: string) { setForm({ ...form, [field]: value }); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await createIntervention({ ...form, workerSignatureUrl: form.workerSignatureUrl || '' });
    setShowForm(false);
    setForm({ caseId: '', type: '', description: '', provider: '' });
    load();
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
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>+ New Intervention</button>
        </div>
      </div>

      {showForm && (
        <div className="card mb-4 max-w-2xl">
          <h3 className="font-heading font-semibold mb-4">Log Intervention</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Case ID (must be disbursed)</label>
                <input className="form-input" required placeholder="Case UUID" value={form.caseId} onChange={e => update('caseId', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-select" required value={form.type} onChange={e => update('type', e.target.value)}>
                  <option value="">Select...</option>
                  <option value="FA">Financial Assistance</option>
                  <option value="C">Counseling</option>
                  <option value="CSR">CSR</option>
                  <option value="R">Referral</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-input min-h-[80px]" required value={form.description} onChange={e => update('description', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Service Provider</label>
              <input className="form-input" required value={form.provider} onChange={e => update('provider', e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary">Log Intervention</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
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
              <th>Verified</th>
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
                <td>{i.verified ? <span className="badge-approved">✓ Verified</span> : <span className="badge-pending">Pending</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
