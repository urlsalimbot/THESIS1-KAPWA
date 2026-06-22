import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { assignCard, getBeneficiaryCard } from '../lib/api';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface ServiceLog { id: string; accessCardCode: string; serviceType: string; serviceDate: string; servedBy?: string; remarks: string; createdAt: string; }

export function AccessCardPage() {
  const navigate = useNavigate();
  const [services, setServices] = useState<ServiceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [beneficiaryId, setBeneficiaryId] = useState('');
  const [assignedCode, setAssignedCode] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [cardSearchInput, setCardSearchInput] = useState('');
  const [cardData, setCardData] = useState<{ beneficiary: any; code: string; services: any[] } | null>(null);
  const [logForm, setLogForm] = useState({ accessCardCode: '', serviceType: '', serviceDate: '', remarks: '' });
  const [successBanner, setSuccessBanner] = useState('');

  async function loadServices(signal?: AbortSignal) {
    try {
      const token = localStorage.getItem('kapwa_token');
      const res = await fetch(API + '/access-cards', { headers: { Authorization: 'Bearer ' + token }, signal });
      if (res.ok) setServices(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { const ac = new AbortController(); loadServices(ac.signal); return () => ac.abort(); }, []);

  useEffect(() => {
    if (successBanner) {
      const t = setTimeout(() => setSuccessBanner(''), 3000);
      return () => clearTimeout(t);
    }
  }, [successBanner]);

  async function handleAssign() {
    if (!beneficiaryId.trim()) return;
    setAssigning(true);
    setAssignError('');
    setAssignedCode('');
    try {
      const result = await assignCard(beneficiaryId.trim());
      setAssignedCode(result.accessCardCode);
      setSuccessBanner(`Access Card assigned: ${result.accessCardCode}`);
    } catch (e: any) {
      setAssignError(e.message || 'Failed to assign card');
    }
    setAssigning(false);
  }

  async function handleSearchCard() {
    if (!cardSearchInput.trim()) return;
    try {
      const data = await getBeneficiaryCard(cardSearchInput.trim());
      setCardData(data);
    } catch (e) {
      setCardData(null);
    }
  }

  async function logService(e: React.FormEvent) {
    e.preventDefault();
    try {
      const token = localStorage.getItem('kapwa_token');
      const res = await fetch(API + '/access-cards/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(logForm),
      });
      if (res.ok) { setLogForm({ accessCardCode: '', serviceType: '', serviceDate: '', remarks: '' }); loadServices(); }
    } catch (e) { console.error(e); }
  }

  if (loading) return <div className="p-6 text-gray-400">Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold text-[#1a1a1a]">Access Card Manager</h1>

      {successBanner && (
        <div className="mb-4 rounded bg-green-50 p-3 text-sm font-medium text-green-700 border border-green-200">
          {successBanner}
        </div>
      )}

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Generate & Assign Access Card</h2>
        <div className="flex items-center gap-2">
          <input
            placeholder="Beneficiary ID (UUID)"
            value={beneficiaryId}
            onChange={e => setBeneficiaryId(e.target.value)}
            aria-label="Beneficiary ID"
            className="flex-1 rounded border border-gray-300 p-2 text-sm font-mono"
          />
          <button
            onClick={handleAssign}
            disabled={assigning || !beneficiaryId.trim()}
            className="rounded bg-[#2E5C8A] px-4 py-2 text-xs text-white hover:bg-[#1e3d5e] disabled:opacity-50"
            aria-label="Generate and Assign Card"
          >
            {assigning ? 'Assigning...' : 'Generate & Assign Card'}
          </button>
        </div>
        {assignedCode && (
          <div className="mt-2 rounded bg-green-50 p-2 text-sm font-medium text-green-700">
            Card Assigned: <span className="font-mono">{assignedCode}</span>
          </div>
        )}
        {assignError && (
          <div className="mt-2 rounded bg-red-50 p-2 text-sm text-red-700">{assignError}</div>
        )}
      </div>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Look Up Beneficiary Card</h2>
        <div className="flex items-center gap-2 mb-2">
          <input
            placeholder="Beneficiary ID (UUID)"
            value={cardSearchInput}
            onChange={e => setCardSearchInput(e.target.value)}
            aria-label="Search Beneficiary Card"
            className="flex-1 rounded border border-gray-300 p-2 text-sm font-mono"
          />
          <button
            onClick={handleSearchCard}
            className="rounded bg-gray-100 px-4 py-2 text-xs text-gray-700 hover:bg-gray-200"
            aria-label="Look up"
          >
            Look Up
          </button>
        </div>
        {cardData && (
          <div className="mt-2 rounded bg-blue-50 p-3 text-sm">
            <p className="font-medium text-blue-800">
              Card: <span className="font-mono">{cardData.code}</span>
            </p>
            {cardData.beneficiary && (
              <p className="text-blue-600 text-xs mt-1">
                {cardData.beneficiary.surname}, {cardData.beneficiary.first_name} — {cardData.beneficiary.barangay}
              </p>
            )}
            <button
              onClick={() => navigate(`/beneficiary/${cardSearchInput}/card/print`)}
              className="mt-2 rounded bg-[#2E5C8A] px-3 py-1 text-xs text-white hover:bg-[#1e3d5e]"
            >
              Print Card
            </button>
          </div>
        )}
      </div>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Log Service to Access Card</h2>
        <form onSubmit={logService} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input placeholder="Access Card Code" aria-label="Access Card Code" value={logForm.accessCardCode} onChange={e => setLogForm({ ...logForm, accessCardCode: e.target.value })} className="rounded border border-gray-300 p-2 text-sm" required />
          <select value={logForm.serviceType} onChange={e => setLogForm({ ...logForm, serviceType: e.target.value })} className="rounded border border-gray-300 p-2 text-sm" required>
            <option value="">Service Type</option>
            <option value="FA">Financial Assistance</option>
            <option value="C">Counseling</option>
            <option value="CSR">Case Study Report</option>
            <option value="R">Referral</option>
            <option value="H">Healthcare</option>
            <option value="HV">Home Visit</option>
          </select>
          <input type="date" value={logForm.serviceDate} onChange={e => setLogForm({ ...logForm, serviceDate: e.target.value })} aria-label="Service Date" className="rounded border border-gray-300 p-2 text-sm" required />
          <button type="submit" className="rounded bg-[#2E5C8A] px-4 py-2 text-xs text-white hover:bg-[#1e3d5e]" aria-label="Log Service">Log Service</button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Card Code</th>
              <th className="px-4 py-3">Service Type</th>
              <th className="px-4 py-3">Service Date</th>
              <th className="px-4 py-3">Served By</th>
              <th className="px-4 py-3">Remarks</th>
              <th className="px-4 py-3">Logged At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {services.map(s => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs font-medium">{s.accessCardCode}</td>
                <td className="px-4 py-3"><span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">{s.serviceType}</span></td>
                <td className="px-4 py-3">{new Date(s.serviceDate).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-gray-600">{s.servedBy || '-'}</td>
                <td className="px-4 py-3 text-gray-500">{s.remarks || '-'}</td>
                <td className="px-4 py-3 text-gray-500">{new Date(s.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {services.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No services logged</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
