import React, { useState, useEffect } from 'react';
import '../index.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface ServiceRecord {
  id: string; type: string; date: string; amount: number; status: string;
}

interface ConsentRecord {
  id: string; purpose: string; channel: string; status: string; grantedAt: string;
}

export function ClaimantDashboardPage() {
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [caseStatus, setCaseStatus] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const token = localStorage.getItem('kapwa_token');
      const [svcRes, conRes] = await Promise.all([
        fetch(`${API_URL}/beneficiaries/me/services`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/beneficiaries/me/consent`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (svcRes.ok) {
        const data = await svcRes.json();
        setServices(data.services || []);
        setCaseStatus(data.caseStatus || 'No active case');
      }
      if (conRes.ok) setConsents(await conRes.json());
    } catch {} finally { setLoading(false); }
  }

  if (loading) return <div className="flex items-center justify-center min-h-[400px] text-gray-400">Loading dashboard...</div>;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#1A1A1A]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>My Dashboard</h2>
        <p className="text-sm text-gray-500">Service history, case status, and consent management</p>
      </div>

      {/* Case Status */}
      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Case Status</p>
            <p className="text-lg font-semibold text-[#2E5C8A]">{caseStatus}</p>
          </div>
          <div className={`rounded-full px-3 py-1 text-xs font-medium ${
            caseStatus === 'Disbursed' ? 'bg-green-100 text-green-700' :
            caseStatus === 'Approved' ? 'bg-blue-100 text-blue-700' :
            'bg-amber-100 text-amber-700'
          }`}>{caseStatus}</div>
        </div>
      </div>

      {/* Service History */}
      <div className="mb-4 rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3">
          <h3 className="font-semibold text-sm text-[#2E5C8A]">Service History</h3>
        </div>
        {services.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No service records yet</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {services.map(s => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{s.type}</p>
                  <p className="text-xs text-gray-500">{new Date(s.date).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  {s.amount > 0 && <p className="text-sm font-semibold">₱{s.amount.toLocaleString()}</p>}
                  <span className={`text-xs ${s.status === 'completed' ? 'text-green-600' : 'text-amber-600'}`}>{s.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Consent Hub */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <h3 className="font-semibold text-sm text-[#2E5C8A]">Consent Management</h3>
          <button className="rounded bg-[#2E5C8A] px-3 py-1 text-xs text-white hover:bg-[#1e3d5e]">Manage Consent</button>
        </div>
        {consents.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No consent records</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {consents.map(c => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{c.purpose}</p>
                  <p className="text-xs text-gray-500">Via {c.channel} · {new Date(c.grantedAt).toLocaleDateString()}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>{c.status}</span>
              </div>
            ))}
          </div>
        )}
        <div className="border-t border-gray-100 px-4 py-3">
          <p className="text-xs text-gray-400">Your data is processed per RA 10173 (Data Privacy Act). You may revoke consent at any time.</p>
        </div>
      </div>
    </div>
  );
}
