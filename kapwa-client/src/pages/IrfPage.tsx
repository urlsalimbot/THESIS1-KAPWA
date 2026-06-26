import React, { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createIrf, exportIrfPdf, exportIrfJson } from '../lib/api';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface IrfCase {
  id: string;
  blotterEntryNumber: string;
  caseCategory: string;
  datetimeReported: string;
  itemAReportingPerson: Record<string, unknown>;
  caseDisposition: string;
  createdAt: string;
}

export function IrfPage() {
  const navigate = useNavigate();
  const [irfs, setIrf] = useState<IrfCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ caseCategory: '', narration: '', reporterName: '', reporterContact: '' });
  const [exportIrfId, setExportIrfId] = useState<string | null>(null);
  const [legalBasis, setLegalBasis] = useState('');
  const [pdfPassword, setPdfPassword] = useState('');
  const [exporting, setExporting] = useState(false);

  async function load(signal?: AbortSignal) {
    try {
      const token = localStorage.getItem('kapwa_token');
      const res = await fetch(API + '/irf', { headers: { Authorization: 'Bearer ' + token }, signal });
      if (res.ok) setIrf(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createIrf({
        caseCategory: form.caseCategory,
        narration: form.narration,
        itemAReportingPerson: { name: form.reporterName, contact: form.reporterContact },
      });
      setShowForm(false);
      setForm({ caseCategory: '', narration: '', reporterName: '', reporterContact: '' });
      load();
    } catch (e) { console.error(e); }
  }

  async function handleExportPdf() {
    if (!exportIrfId || !legalBasis) return;
    setExporting(true);
    try {
      await exportIrfPdf(exportIrfId, legalBasis, pdfPassword || 'default');
      setExportIrfId(null);
      setLegalBasis('');
      setPdfPassword('');
    } catch (e) { console.error('PDF export:', e); alert('PDF export failed'); }
    setExporting(false);
  }

  async function handleExportJson() {
    if (!exportIrfId || !legalBasis) return;
    setExporting(true);
    try {
      const data = await exportIrfJson(exportIrfId, legalBasis);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `IRF-${exportIrfId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportIrfId(null);
      setLegalBasis('');
      setPdfPassword('');
    } catch (e) { console.error('JSON export:', e); alert('JSON export failed'); }
    setExporting(false);
  }

  if (loading) return <div className="p-6 text-gray-400">Loading IRF cases...</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Incident Report Forms (IRF)</h1>
        <button onClick={() => setShowForm(!showForm)} className="rounded bg-primary px-4 py-2 text-sm text-white hover:bg-primary-dark" aria-label="New IRF">
          {showForm ? 'Cancel' : 'New IRF'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-gray-700">Case Category</label>
            <select value={form.caseCategory} onChange={e => setForm({ ...form, caseCategory: e.target.value })} aria-label="Case Category" className="w-full rounded border border-gray-300 p-2 text-sm" required>
              <option value="">Select...</option>
              <option value="Abuse">Abuse</option>
              <option value="Neglect">Neglect</option>
              <option value="Exploitation">Exploitation</option>
              <option value="Criminal">Criminal</option>
            </select>
          </div>
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-gray-700">Reporter Name</label>
            <input value={form.reporterName} onChange={e => setForm({ ...form, reporterName: e.target.value })} aria-label="Reporter Name" className="w-full rounded border border-gray-300 p-2 text-sm" required />
          </div>
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-gray-700">Reporter Contact</label>
            <input value={form.reporterContact} onChange={e => setForm({ ...form, reporterContact: e.target.value })} aria-label="Reporter Contact" className="w-full rounded border border-gray-300 p-2 text-sm" />
          </div>
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-gray-700">Narration (AES-256 encrypted)</label>
            <textarea value={form.narration} onChange={e => setForm({ ...form, narration: e.target.value })} aria-label="Narration" className="w-full rounded border border-gray-300 p-2 text-sm" rows={4} required />
          </div>
          <button type="submit" className="rounded bg-primary px-4 py-2 text-xs text-white hover:bg-primary-dark" aria-label="Submit IRF">Submit IRF</button>
        </form>
      )}

      {/* Export Modal */}
      {exportIrfId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="text-primary" size={20} />
              <h3 className="font-semibold text-gray-800">Export IRF</h3>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Legal basis code is required per DSWD AO 2020-002. This export is logged.
            </p>
            <label className="text-sm font-medium text-gray-700">Legal Basis Code</label>
            <input className="form-input mt-1 w-full" value={legalBasis} onChange={e => setLegalBasis(e.target.value)} aria-label="Legal Basis Code" placeholder="e.g. AO-2020-002" />
            <label className="text-sm font-medium text-gray-700 mt-2 block">PDF Password</label>
            <input className="form-input mt-1 w-full" value={pdfPassword} onChange={e => setPdfPassword(e.target.value)} type="password" aria-label="PDF password" placeholder="PDF password (optional)" />
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => { setExportIrfId(null); setLegalBasis(''); setPdfPassword(''); }} className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50" aria-label="Cancel">
                Cancel
              </button>
              <button onClick={handleExportJson} disabled={!legalBasis || exporting} className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                Export JSON
              </button>
              <button onClick={handleExportPdf} disabled={!legalBasis || exporting} className="rounded bg-primary px-4 py-2 text-sm text-white hover:bg-primary-dark disabled:opacity-40">
                {exporting ? 'Exporting...' : 'Export PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Blotter #</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Reporter</th>
              <th className="px-4 py-3">Disposition</th>
              <th className="px-4 py-3">Reported</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {irfs.map(irf => (
              <tr key={irf.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{irf.blotterEntryNumber}</td>
                <td className="px-4 py-3"><span className="rounded bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">{irf.caseCategory}</span></td>
                <td className="px-4 py-3 text-gray-600">{(irf.itemAReportingPerson as Record<string, unknown>)?.name as string || '[CONFIDENTIAL]'}</td>
                <td className="px-4 py-3">{irf.caseDisposition}</td>
                <td className="px-4 py-3 text-gray-500">{new Date(irf.datetimeReported).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => navigate('/irf/' + irf.id)}
                      className="text-sm text-primary hover:underline" aria-label="View Details">
                      View Details
                    </button>
                    <button onClick={() => setExportIrfId(irf.id)} className="flex items-center gap-1 text-xs text-primary hover:underline" aria-label="Export IRF">
                      <Shield size={14} /> Export
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {irfs.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No IRF cases filed</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
