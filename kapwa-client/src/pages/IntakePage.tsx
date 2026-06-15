import React, { useState, useEffect } from 'react';
import { queueChange } from '../lib/offline-queue';
import { isOnline } from '../lib/sync';
import SignaturePad from '../components/forms/SignaturePad';
import '../index.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const BARANGAYS = ['Bigte','Matictic','Partida','San Mateo','Tigbe','Minuyan','San Roque','Samson','FVR','Sta. Lucia'];
const AGE_RANGES = ['0-7','8-17','18-59','60+'];
const CLIENT_CATEGORIES = ['Children','Youth','Women','PWD','Senior','Family'];
const SERVICE_TYPES = ['Financial Aid','Case Study Report','PWD Referral','Medical Assistance','Burial Assistance','Food Assistance','Educational Assistance','Transportation','Others'];

interface FamilyMember {
  id: string;
  fullName: string;
  relationship: string;
  age: number | '';
  statusIncome: string;
}

interface Requirement {
  key: string;
  label: string;
  checked: boolean;
}

export function IntakePage() {
  const [form, setForm] = useState({
    surname: '', firstName: '', middleName: '',
    gender: 'Male' as string,
    dob: '',
    address: '',
    phone: '',
    barangay: '',
    purok: '',
    serviceRequested: [] as string[],
    assessedBy: '',
    hasConsent: false,
  });
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([
    { key: 'med_cert', label: 'Medical Certificate', checked: false },
    { key: 'indigency', label: 'Certificate of Indigency', checked: false },
    { key: 'valid_id', label: 'Valid Government ID', checked: false },
    { key: 'birth_cert', label: 'Birth Certificate', checked: false },
    { key: 'barangay_clearance', label: 'Barangay Clearance', checked: false },
  ]);
  const [signature, setSignature] = useState<string | null>(null);
  const [sigResetKey, setSigResetKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [offlineMode, setOfflineMode] = useState(false);

  useEffect(() => {
    if (!isOnline()) setOfflineMode(true);
    const handleOnline = () => setOfflineMode(false);
    const handleOffline = () => setOfflineMode(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  function update(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function toggleService(svc: string) {
    setForm(prev => ({
      ...prev,
      serviceRequested: prev.serviceRequested.includes(svc)
        ? prev.serviceRequested.filter(s => s !== svc)
        : [...prev.serviceRequested, svc],
    }));
  }

  function toggleRequirement(key: string) {
    setRequirements(prev =>
      prev.map(r => r.key === key ? { ...r, checked: !r.checked } : r)
    );
  }

  function addFamilyMember() {
    setFamily(prev => [...prev, {
      id: crypto.randomUUID(),
      fullName: '',
      relationship: 'Spouse',
      age: '' as const,
      statusIncome: 'Employed',
    }]);
  }

  function updateFamilyMember(id: string, field: string, value: any) {
    setFamily(prev =>
      prev.map(m => m.id === id ? { ...m, [field]: value } : m)
    );
  }

  function removeFamilyMember(id: string) {
    setFamily(prev => prev.filter(m => m.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.hasConsent) {
      setError('Consent required per Data Privacy Act (RA 10173)');
      return;
    }
    if (!form.surname || !form.firstName || !form.dob || !form.barangay) {
      setError('Complete all required fields');
      return;
    }
    if (!signature) {
      setError('Worker signature is required');
      return;
    }

    setSubmitting(true);

    const payload = {
      beneficiary: {
        surname: form.surname,
        first_name: form.firstName,
        middle_name: form.middleName,
        gender: form.gender,
        dob: form.dob,
        address: `${form.purok ? form.purok + ', ' : ''}${form.barangay}`,
        phone: form.phone,
        barangay: form.barangay,
      },
      familyMembers: family.filter(m => m.fullName.trim()),
      case: {
        service_requested: form.serviceRequested,
        requirements_checklist: requirements,
        assessed_by: form.assessedBy,
        worker_signature: signature,
        has_consent: form.hasConsent,
      },
    };

    try {
      if (offlineMode) {
        await queueChange('cases', crypto.randomUUID(), 'INSERT', payload);
        setSuccess('Queued for sync — will be submitted when online.');
      } else {
        const token = localStorage.getItem('kapwa_token');
        const res = await fetch(`${API_URL}/cases`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.text();
          throw new Error(err);
        }

        const data = await res.json();
        setSuccess(`Case ${data.control_no} created successfully!`);
        resetForm();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit intake');
      // fallback: queue for sync
      await queueChange('cases', crypto.randomUUID(), 'INSERT', payload);
      setError('Submission failed — queued for sync when online.');
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setSignature(null);
    setSigResetKey(k => k + 1);
    setForm({ surname: '', firstName: '', middleName: '', gender: 'Male', dob: '', address: '', phone: '', barangay: '', purok: '', serviceRequested: [], assessedBy: '', hasConsent: false });
    setFamily([]);
    setRequirements(prev => prev.map(r => ({ ...r, checked: false })));
    setSignature(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#1A1A1A]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>GIS Intake Form</h2>
          <p className="text-sm text-gray-500">General Intake Sheet — Client Stub + Assessment</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${offlineMode ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
          <span className={`w-2 h-2 rounded-full ${offlineMode ? 'bg-amber-500' : 'bg-green-500'}`} />
          {offlineMode ? 'Offline — changes queued' : 'Online'}
        </div>
      </div>

      {success && <div className="mb-4 rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">{success}</div>}
      {error && <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      <form onSubmit={handleSubmit} className="max-w-4xl space-y-6">
        {/* Client Stub Section */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 font-semibold text-[#2E5C8A]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Client Stub / Beneficiary Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Surname *</label>
              <input className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#2E5C8A] focus:outline-none" required value={form.surname} onChange={e => update('surname', e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">First Name *</label>
              <input className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#2E5C8A] focus:outline-none" required value={form.firstName} onChange={e => update('firstName', e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Middle Name</label>
              <input className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#2E5C8A] focus:outline-none" value={form.middleName} onChange={e => update('middleName', e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Gender *</label>
              <select className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#2E5C8A] focus:outline-none" value={form.gender} onChange={e => update('gender', e.target.value)}>
                <option>Male</option><option>Female</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Date of Birth *</label>
              <input type="date" className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#2E5C8A] focus:outline-none" required value={form.dob} onChange={e => update('dob', e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Contact Number</label>
              <input type="tel" className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#2E5C8A] focus:outline-none" value={form.phone} onChange={e => update('phone', e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Barangay *</label>
              <select className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#2E5C8A] focus:outline-none" required value={form.barangay} onChange={e => update('barangay', e.target.value)}>
                <option value="">Select...</option>
                {BARANGAYS.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Purok / Zone</label>
              <input className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#2E5C8A] focus:outline-none" value={form.purok} onChange={e => update('purok', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Family Composition */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[#2E5C8A]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Family Composition</h3>
            <button type="button" onClick={addFamilyMember} className="rounded bg-[#2E5C8A] px-3 py-1 text-xs text-white hover:bg-[#1e3d5e]">
              + Add Member
            </button>
          </div>
          {family.length === 0 && <p className="text-sm text-gray-400 italic">No family members added yet</p>}
          {family.map(m => (
            <div key={m.id} className="mb-3 flex flex-wrap items-end gap-2 rounded border border-gray-100 bg-gray-50 p-3">
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs text-gray-500">Full Name</label>
                <input className="w-full rounded border border-gray-300 px-2 py-1 text-sm" value={m.fullName} onChange={e => updateFamilyMember(m.id, 'fullName', e.target.value)} />
              </div>
              <div className="w-24">
                <label className="block text-xs text-gray-500">Relation</label>
                <select className="w-full rounded border border-gray-300 px-2 py-1 text-sm" value={m.relationship} onChange={e => updateFamilyMember(m.id, 'relationship', e.target.value)}>
                  {['Spouse','Child','Parent','Sibling','Grandparent','Other'].map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div className="w-16">
                <label className="block text-xs text-gray-500">Age</label>
                <input type="number" min="0" className="w-full rounded border border-gray-300 px-2 py-1 text-sm" value={m.age} onChange={e => updateFamilyMember(m.id, 'age', e.target.value === '' ? '' : Number(e.target.value))} />
              </div>
              <div className="w-24">
                <label className="block text-xs text-gray-500">Income Status</label>
                <select className="w-full rounded border border-gray-300 px-2 py-1 text-sm" value={m.statusIncome} onChange={e => updateFamilyMember(m.id, 'statusIncome', e.target.value)}>
                  {['Employed','Unemployed','Student','PWD','Senior'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <button type="button" onClick={() => removeFamilyMember(m.id)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-600 hover:bg-red-200">Remove</button>
            </div>
          ))}
        </div>

        {/* Service Requested & Requirements */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 font-semibold text-[#2E5C8A]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Service Request & Requirements</h3>
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">Service Requested *</label>
            <div className="flex flex-wrap gap-2">
              {SERVICE_TYPES.map(svc => (
                <label key={svc} className={`cursor-pointer rounded border px-3 py-1 text-xs font-medium transition-colors ${form.serviceRequested.includes(svc) ? 'border-[#2E5C8A] bg-[#2E5C8A] text-white' : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}>
                  <input type="checkbox" className="hidden" checked={form.serviceRequested.includes(svc)} onChange={() => toggleService(svc)} />
                  {svc}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Requirements Checklist</label>
            <div className="grid grid-cols-2 gap-2">
              {requirements.map(r => (
                <label key={r.key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={r.checked} onChange={() => toggleRequirement(r.key)} className="rounded border-gray-300 text-[#2E5C8A]" />
                  {r.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Assessment & Signature */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 font-semibold text-[#2E5C8A]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Assessment</h3>
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">Assessed By (MSWDO Staff) *</label>
            <input className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#2E5C8A] focus:outline-none" required value={form.assessedBy} onChange={e => update('assessedBy', e.target.value)} />
          </div>
          <SignaturePad key={sigResetKey} onSave={setSignature} label="Worker Signature *" />
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.hasConsent} onChange={e => update('hasConsent', e.target.checked)} className="rounded border-gray-300 text-[#2E5C8A]" />
            <span>I confirm the beneficiary has given consent per Data Privacy Act (RA 10173) and this data will be logged in the consent ledger</span>
          </label>
        </div>

        <div className="flex gap-3">
          <button type="submit" className="rounded bg-[#2E5C8A] px-8 py-2 text-sm font-medium text-white hover:bg-[#1e3d5e] disabled:opacity-50" disabled={submitting}>
            {submitting ? 'Submitting...' : offlineMode ? 'Queue for Sync' : 'Submit Intake'}
          </button>
          <button type="button" onClick={resetForm} className="rounded border border-gray-300 bg-white px-8 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}
