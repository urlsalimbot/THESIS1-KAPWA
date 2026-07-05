import React, { useState, useEffect } from 'react';
import { queueChange } from '../lib/offline-queue';
import { isOnline } from '../lib/sync';
import { submitIntake } from '../lib/api';
import SignaturePad from '../components/forms/SignaturePad';
import { PageShell } from '@/components/PageShell';


const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
import { BARANGAYS, SERVICE_TYPES } from '../lib/constants';

const CATEGORIES = ['Senior', 'PWD', 'Child', 'Solo Parent', 'Indigenous', 'Others'];

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
    category: '',
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

  function update(field: string, value: string | number | boolean | string[]) {
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

  function updateFamilyMember(id: string, field: string, value: string | number | boolean | string[]) {
    setFamily(prev =>
      prev.map(m => m.id === id ? { ...m, [field]: value } : m)
    );
  }

  function removeFamilyMember(id: string) {
    setFamily(prev => prev.filter(m => m.id !== id));
  }

  function buildConsolidatedPayload() {
    return {
      beneficiary: {
        surname: form.surname,
        firstName: form.firstName,
        middleName: form.middleName,
        gender: form.gender,
        dob: form.dob,
        barangay: form.barangay,
        purok: form.purok || undefined,
        phone: form.phone || undefined,
        category: form.category || undefined,
      },
      familyMembers: family.filter(m => m.fullName.trim()).map(f => ({
        fullName: f.fullName,
        relationship: f.relationship,
        age: f.age || undefined,
        statusIncome: f.statusIncome || undefined,
      })),
      case: {
        serviceRequested: form.serviceRequested,
        requirementsChecklist: Object.fromEntries(requirements.map(r => [r.key, r.checked])),
        assessedBy: form.assessedBy,
        assignedWorkerId: undefined,
      },
    };
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

    const payload = buildConsolidatedPayload();

    try {
      if (offlineMode) {
        await queueChange('intake', crypto.randomUUID(), 'INSERT', payload);
        setSuccess('Queued for sync — will be submitted when online.');
      } else {
        const data = await submitIntake(payload);
        setSuccess(`Case ${data.controlNo || ''} created successfully!`);
        resetForm();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err) || 'Failed to submit intake');
      // fallback: queue for sync
      await queueChange('intake', crypto.randomUUID(), 'INSERT', payload);
      setError('Submission failed — queued for sync when online.');
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setSignature(null);
    setSigResetKey(k => k + 1);
    setForm({ surname: '', firstName: '', middleName: '', gender: 'Male', dob: '', address: '', phone: '', barangay: '', purok: '', category: '', serviceRequested: [], assessedBy: '', hasConsent: false });
    setFamily([]);
    setRequirements(prev => prev.map(r => ({ ...r, checked: false })));
    setSignature(null);
  }

  return (
    <PageShell
      title="GIS Intake Form"
      description="General Intake Sheet — Client Stub + Assessment"
      actions={
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${offlineMode ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
          <span className={`w-2 h-2 rounded-full ${offlineMode ? 'bg-amber-500' : 'bg-green-500'}`} />
          {offlineMode ? 'Offline — changes queued' : 'Online'}
        </div>
      }
    >

      {success && <div className="mb-4 rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">{success}</div>}
      {error && <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      <form onSubmit={handleSubmit} className="max-w-4xl space-y-6">
        {/* Client Stub Section */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 font-semibold text-primary">Client Stub / Beneficiary Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="surname" className="mb-1 block text-sm font-medium text-gray-700">Surname *</label>
              <input id="surname" className="w-full rounded border border-input px-3 py-2 text-sm focus:border-primary focus:outline-none" required value={form.surname} onChange={e => update('surname', e.target.value)} aria-label="Surname" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">First Name *</label>
              <input className="w-full rounded border border-input px-3 py-2 text-sm focus:border-primary focus:outline-none" required value={form.firstName} onChange={e => update('firstName', e.target.value)} aria-label="First Name" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Middle Name</label>
              <input className="w-full rounded border border-input px-3 py-2 text-sm focus:border-primary focus:outline-none" value={form.middleName} onChange={e => update('middleName', e.target.value)} aria-label="Middle Name" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Gender *</label>
              <select className="w-full rounded border border-input px-3 py-2 text-sm focus:border-primary focus:outline-none" value={form.gender} onChange={e => update('gender', e.target.value)} aria-label="Gender">
                <option>Male</option><option>Female</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Date of Birth *</label>
              <input type="date" className="w-full rounded border border-input px-3 py-2 text-sm focus:border-primary focus:outline-none" required value={form.dob} onChange={e => update('dob', e.target.value)} aria-label="Date of Birth" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Contact Number</label>
              <input type="tel" className="w-full rounded border border-input px-3 py-2 text-sm focus:border-primary focus:outline-none" value={form.phone} onChange={e => update('phone', e.target.value)} aria-label="Contact Number" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Barangay *</label>
              <select className="w-full rounded border border-input px-3 py-2 text-sm focus:border-primary focus:outline-none" required value={form.barangay} onChange={e => update('barangay', e.target.value)} aria-label="Barangay">
                <option value="">Select...</option>
                {BARANGAYS.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Purok / Zone</label>
              <input className="w-full rounded border border-input px-3 py-2 text-sm focus:border-primary focus:outline-none" value={form.purok} onChange={e => update('purok', e.target.value)} aria-label="Purok / Zone" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Category</label>
              <select className="w-full rounded border border-input px-3 py-2 text-sm focus:border-primary focus:outline-none" value={form.category} onChange={e => update('category', e.target.value)} aria-label="Category">
                <option value="">Select...</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Family Composition */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-primary">Family Composition</h3>
            <button type="button" onClick={addFamilyMember} className="rounded bg-primary px-3 py-1 text-xs text-white hover:bg-primary-dark">
              + Add Member
            </button>
          </div>
          {family.length === 0 && <p className="text-sm text-gray-400 italic">No family members added yet</p>}
          {family.map(m => (
            <div key={m.id} className="mb-3 flex flex-wrap items-end gap-2 rounded border border-gray-100 bg-gray-50 p-3">
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs text-gray-500">Full Name</label>
                <input className="w-full rounded border border-input px-2 py-1 text-sm" value={m.fullName} onChange={e => updateFamilyMember(m.id, 'fullName', e.target.value)} aria-label="Family Member Full Name" />
              </div>
              <div className="w-24">
                <label className="block text-xs text-gray-500">Relation</label>
                <select className="w-full rounded border border-input px-2 py-1 text-sm" value={m.relationship} onChange={e => updateFamilyMember(m.id, 'relationship', e.target.value)} aria-label="Family Member Relation">
                  {['Spouse','Child','Parent','Sibling','Grandparent','Other'].map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div className="w-16">
                <label className="block text-xs text-gray-500">Age</label>
                <input type="number" min="0" className="w-full rounded border border-input px-2 py-1 text-sm" value={m.age} onChange={e => updateFamilyMember(m.id, 'age', e.target.value === '' ? '' : Number(e.target.value))} aria-label="Family Member Age" />
              </div>
              <div className="w-24">
                <label className="block text-xs text-gray-500">Income Status</label>
                <select className="w-full rounded border border-input px-2 py-1 text-sm" value={m.statusIncome} onChange={e => updateFamilyMember(m.id, 'statusIncome', e.target.value)} aria-label="Family Member Income Status">
                  {['Employed','Unemployed','Student','PWD','Senior'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <button type="button" onClick={() => removeFamilyMember(m.id)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-600 hover:bg-red-200" aria-label="Remove">Remove</button>
            </div>
          ))}
        </div>

        {/* Service Requested & Requirements */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 font-semibold text-primary">Service Request & Requirements</h3>
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">Service Requested *</label>
            <div className="flex flex-wrap gap-2">
              {SERVICE_TYPES.map(svc => (
                <label key={svc} className={`cursor-pointer rounded border px-3 py-1 text-xs font-medium transition-colors ${form.serviceRequested.includes(svc) ? 'border-primary bg-primary text-white' : 'border-input text-gray-600 hover:border-gray-400'}`}>
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
                  <input type="checkbox" checked={r.checked} onChange={() => toggleRequirement(r.key)} className="rounded border-input text-primary" />
                  {r.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Assessment & Signature */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 font-semibold text-primary">Assessment</h3>
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">Assessed By (MSWDO Staff) *</label>
            <input className="w-full rounded border border-input px-3 py-2 text-sm focus:border-primary focus:outline-none" required value={form.assessedBy} onChange={e => update('assessedBy', e.target.value)} aria-label="Assessed By" />
          </div>
          <SignaturePad key={sigResetKey} onSave={setSignature} label="Worker Signature *" />
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.hasConsent} onChange={e => update('hasConsent', e.target.checked)} className="rounded border-input text-primary" />
            <span>I confirm the beneficiary has given consent per Data Privacy Act (RA 10173) and this data will be logged in the consent ledger</span>
          </label>
        </div>

        <div className="flex gap-3">
          <button type="submit" className="rounded bg-primary px-8 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50" disabled={submitting} aria-label="Submit Intake">
            {submitting ? 'Submitting...' : offlineMode ? 'Queue for Sync' : 'Submit Intake'}
          </button>
          <button type="button" onClick={resetForm} className="rounded border border-input bg-white px-8 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Reset
          </button>
        </div>
      </form>
    </PageShell>
  );
}
