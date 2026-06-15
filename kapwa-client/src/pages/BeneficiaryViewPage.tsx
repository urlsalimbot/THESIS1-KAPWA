import React, { useState, useEffect } from 'react';
import { ArrowLeft, User, MapPin, Users as UsersIcon, Gift, FileText, Plus, Edit, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { getBeneficiary, getCases } from '../lib/api';
import '../index.css';

interface BeneficiaryDetail {
  id: string;
  name: string;
  age: number;
  birthDate: string;
  gender: string;
  contact: string;
  barangay: string;
  purok: string;
  category: string;
  householdSize: number;
  status: string;
  cases: { id: string; program: string; status: string; date: string; amount?: string }[];
  interventions: { id: string; type: string; description: string; date: string }[];
}

export function BeneficiaryViewPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [beneficiary, setBeneficiary] = useState<BeneficiaryDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    Promise.all([
      getBeneficiary(id).catch(() => null),
      getCases().catch(() => []),
    ]).then(([ben, cases]) => {
      if (ben) {
        const age = ben.dob ? new Date().getFullYear() - new Date(ben.dob).getFullYear() : 0;
        const addrParts = (ben.address || '').split(',').map((s: string) => s.trim());
        const beneficiaryCases = (cases || []).filter((c: any) => c.beneficiaryId === id || c.beneficiary?.id === id);
        setBeneficiary({
          id: ben.id,
          name: `${ben.firstName || ''} ${ben.middleName || ''} ${ben.surname || ''}`.trim(),
          age,
          birthDate: ben.dob || '',
          gender: ben.gender || '',
          contact: ben.phone || '',
          barangay: addrParts[addrParts.length - 1] || '',
          purok: addrParts.length > 1 ? addrParts[0] : '',
          category: ben.category || '',
          householdSize: 1,
          status: ben.consentStatus || 'active',
          cases: beneficiaryCases.map((c: any) => ({
            id: c.controlNo || c.id,
            program: (c.serviceRequested || []).join(', ') || 'General',
            status: c.status || 'pending',
            date: c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '',
          })),
          interventions: [],
        });
      }
      setLoading(false);
    });
  }, [id]);

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; color: string; label: string }> = {
      approved: { bg: '#D4EDDA', color: '#155724', label: 'Approved' },
      disbursed: { bg: '#E2E3E5', color: '#383D41', label: 'Disbursed' },
      pending_assessment: { bg: '#FFF3CD', color: '#856404', label: 'Pending' },
      active: { bg: '#D4EDDA', color: '#155724', label: 'Active' },
      closed: { bg: '#E2E3E5', color: '#383D41', label: 'Closed' },
    };
    const s = map[status];
    return s ? <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: s.bg, color: s.color }}>{s.label}</span> : <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">{status}</span>;
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>;
  if (!beneficiary) return <div className="p-8 text-center text-gray-400">Beneficiary not found</div>;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-[#2E5C8A] hover:underline">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-100">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2E5C8A] text-2xl font-bold text-white">
              {beneficiary.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#1A1A1A]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{beneficiary.name}</h2>
              <p className="text-sm text-gray-500">ID: {beneficiary.id}</p>
              <div className="mt-1 flex items-center gap-3 text-sm text-gray-600">
                <span className="flex items-center gap-1"><User size={14} /> {beneficiary.gender}, {beneficiary.age} yrs old</span>
                <span className="flex items-center gap-1"><MapPin size={14} /> {beneficiary.barangay}{beneficiary.purok ? `, ${beneficiary.purok}` : ''}</span>
              </div>
            </div>
          </div>
          {statusBadge(beneficiary.status)}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-100">
          <div className="mb-3 flex items-center gap-2 text-[#2E5C8A]"><UsersIcon size={18} /> <h3 className="text-sm font-semibold">Personal Info</h3></div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Birth Date</span><span>{beneficiary.birthDate}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Contact</span><span>{beneficiary.contact || 'N/A'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Category</span><span>{beneficiary.category || 'N/A'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Household</span><span>{beneficiary.householdSize} members</span></div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-100">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#2E5C8A]"><FileText size={18} /> <h3 className="text-sm font-semibold">Active Cases</h3></div>
            <button className="rounded p-1 text-gray-400 hover:text-[#2E5C8A]"><Plus size={16} /></button>
          </div>
          {beneficiary.cases.length === 0 ? (
            <p className="text-sm text-gray-400">No active cases</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {beneficiary.cases.map(c => (
                <div key={c.id} className="flex items-center justify-between rounded bg-gray-50 p-2 text-sm">
                  <div>
                    <p className="font-medium text-gray-800">{c.program}</p>
                    <p className="text-xs text-gray-400">{c.id} · {c.date}</p>
                  </div>
                  {statusBadge(c.status)}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-100">
          <div className="mb-3 flex items-center gap-2 text-[#2E5C8A]"><Gift size={18} /> <h3 className="text-sm font-semibold">Interventions</h3></div>
          {beneficiary.interventions.length === 0 ? (
            <p className="text-sm text-gray-400">No interventions recorded</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {beneficiary.interventions.map(intv => (
                <div key={intv.id} className="rounded bg-gray-50 p-2 text-sm">
                  <p className="font-medium text-gray-800">{intv.type}</p>
                  <p className="text-xs text-gray-400">{intv.description}</p>
                  <p className="text-xs text-gray-400">{intv.date}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
