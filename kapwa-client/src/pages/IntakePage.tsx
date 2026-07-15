import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { PageShell } from '@/components/PageShell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  BARANGAYS, CIVIL_STATUSES, CITIES, PROVINCES,
} from '../lib/constants';

function computeAge(dob: string): number {
  if (!dob) return 0;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function formatMoney(val: string): string {
  const num = parseFloat(val.replace(/,/g, ''));
  if (isNaN(num)) return val.replace(/,/g, '');
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface FamilyMember {
  id: string;
  fullName: string;
  age: number | '';
  relationship: string;
  occupation: string;
  income: string;
  status: string;
}

interface AddressFields {
  street: string;
  barangay: string;
  city: string;
  province: string;
  postalCode: string;
}

const emptyAddress: AddressFields = { street: '', barangay: '', city: 'Norzagaray', province: 'Bulacan', postalCode: '' };

export function IntakePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    surname: '', firstName: '', middleName: '',
    gender: '' as string,
    dob: '',
    placeOfBirth: '',
    civilStatus: '',
    cellularNumber: '',
    currentAddress: { ...emptyAddress },
    provincialAddress: { ...emptyAddress },
    philhealthNumber: '',
    occupation: '',
    estimatedMonthlyIncome: '' as string,
  });
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [hasConsent, setHasConsent] = useState(false);

  const age = computeAge(form.dob);

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function updateAddress(type: 'currentAddress' | 'provincialAddress', field: string, value: string) {
    setForm(prev => ({
      ...prev,
      [type]: { ...prev[type], [field]: value },
    }));
  }

  function addFamilyMember() {
    setFamily(prev => [...prev, {
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      fullName: '',
      age: '' as const,
      relationship: 'Spouse',
      occupation: '',
      income: '',
      status: 'Employed',
    }]);
  }

  function updateFamilyMember(id: string, field: string, value: string | number) {
    setFamily(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
  }

  function removeFamilyMember(id: string) {
    setFamily(prev => prev.filter(m => m.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.surname || !form.firstName || !form.dob || !form.gender || !form.placeOfBirth || !form.civilStatus || !form.cellularNumber || !form.occupation || !form.estimatedMonthlyIncome) {
      setError('Please fill in all required fields');
      return;
    }
    if (!hasConsent) {
      setError('Consent required per Data Privacy Act (RA 10173)');
      setSubmitting(false);
      return;
    }
    setSubmitting(true);
    try {
      const data = await api.post<{ caseId: string; controlNo: string }>('/intake', {
        beneficiary: {
          surname: form.surname,
          firstName: form.firstName,
          middleName: form.middleName || undefined,
          gender: form.gender,
          dob: form.dob,
          age: age,
          placeOfBirth: form.placeOfBirth,
          civilStatus: form.civilStatus,
          cellularNumber: form.cellularNumber,
          currentAddress: form.currentAddress,
          provincialAddress: form.provincialAddress,
          philhealthNumber: form.philhealthNumber || undefined,
          occupation: form.occupation,
          estimatedMonthlyIncome: parseFloat(form.estimatedMonthlyIncome.replace(/,/g, '')) || 0,
        },
        familyMembers: family.filter(m => m.fullName.trim()).map(f => ({
          fullName: f.fullName,
          age: f.age || 0,
          relationship: f.relationship,
          occupation: f.occupation,
          income: f.income ? parseFloat(f.income.replace(/,/g, '')) : undefined,
          status: f.status || undefined,
        })),
        case: {},
      });
      navigate(`/cases/${data.caseId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit intake');
    } finally {
      setSubmitting(false);
    }
  }

  function AddressBlock({ type, label }: { type: 'currentAddress' | 'provincialAddress'; label: string }) {
    const addr = form[type];
    return (
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</h4>
        <div className="space-y-2">
          <label className="text-sm font-medium">House/Unit No., Street, Subdivision</label>
          <Input value={addr.street} onChange={e => updateAddress(type, 'street', e.target.value)} aria-label={`${label} Street`} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Barangay</label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={addr.barangay} onChange={e => updateAddress(type, 'barangay', e.target.value)} aria-label={`${label} Barangay`}>
              <option value="">Select...</option>
              {BARANGAYS.map(b => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">City/Municipality</label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={addr.city} onChange={e => updateAddress(type, 'city', e.target.value)} aria-label={`${label} City`}>
              {CITIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Province</label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={addr.province} onChange={e => updateAddress(type, 'province', e.target.value)} aria-label={`${label} Province`}>
              {PROVINCES.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Postal Code</label>
            <Input type="number" value={addr.postalCode} onChange={e => updateAddress(type, 'postalCode', e.target.value)} aria-label={`${label} Postal Code`} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <PageShell title="GIS Intake Form" description="Client Registration — Personal Information + Family Composition">
      {error && <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
        {/* Section I: Personal Information */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground">I. Personal Information</h2>

          <div className="space-y-4">
            {/* 1. Name */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">1. Name of the Client</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Surname *</label>
                  <Input required value={form.surname} onChange={e => update('surname', e.target.value)} aria-label="Surname" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">First Name *</label>
                  <Input required value={form.firstName} onChange={e => update('firstName', e.target.value)} aria-label="First Name" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Middle Name</label>
                  <Input value={form.middleName} onChange={e => update('middleName', e.target.value)} aria-label="Middle Name" />
                </div>
              </div>
            </div>

            {/* 2. Sex */}
            <div>
              <label className="text-sm font-medium">2. Sex *</label>
              <div className="flex gap-4 mt-1">
                {['Male', 'Female'].map(s => (
                  <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="gender" value={s} checked={form.gender === s} onChange={e => update('gender', e.target.value)} className="text-primary" required />
                    {s}
                  </label>
                ))}
              </div>
            </div>

            {/* 3 + 4. Age + DOB */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">3. Age</label>
                <Input type="number" value={age || ''} disabled aria-label="Age" className="bg-muted" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">4a. Date of Birth *</label>
                <Input type="date" required value={form.dob} onChange={e => update('dob', e.target.value)} aria-label="Date of Birth" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">4b. Place of Birth *</label>
                <Input required value={form.placeOfBirth} onChange={e => update('placeOfBirth', e.target.value)} aria-label="Place of Birth" />
              </div>
            </div>

            {/* 5-6. Civil Status + Cellular */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">5. Civil Status *</label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" required value={form.civilStatus} onChange={e => update('civilStatus', e.target.value)} aria-label="Civil Status">
                  <option value="">Select...</option>
                  {CIVIL_STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">6. Cellular Number *</label>
                <Input type="tel" required value={form.cellularNumber} onChange={e => update('cellularNumber', e.target.value)} aria-label="Cellular Number" />
              </div>
            </div>

            {/* 7-8. Addresses */}
            <Separator />
            <AddressBlock type="currentAddress" label="7. Address (Current)" />
            <Separator />
            <AddressBlock type="provincialAddress" label="8. Provincial Address (Permanent)" />

            {/* 9. PhilHealth */}
            <div className="space-y-2">
              <label className="text-sm font-medium">9. PhilHealth Number</label>
              <Input value={form.philhealthNumber} onChange={e => update('philhealthNumber', e.target.value)} aria-label="PhilHealth Number" placeholder="Optional" />
            </div>

            {/* 10-11. Occupation + Income */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">10. Occupation *</label>
                <Input required value={form.occupation} onChange={e => update('occupation', e.target.value)} aria-label="Occupation" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">11. Estimated Monthly Income *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₱</span>
                  <Input type="text" inputMode="numeric" required value={form.estimatedMonthlyIncome} onChange={e => update('estimatedMonthlyIncome', e.target.value.replace(/,/g, ''))} onBlur={e => update('estimatedMonthlyIncome', formatMoney(e.target.value))} aria-label="Estimated Monthly Income" className="pl-7" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section II: Family Composition */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">II. Family Composition</h2>
            <Button type="button" variant="outline" size="sm" onClick={addFamilyMember}>+ Add Member</Button>
          </div>
          {family.length === 0 && <p className="text-sm text-muted-foreground italic">No family members added</p>}
          {family.map(m => (
            <div key={m.id} className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border bg-muted/30 p-3">
              <div className="flex-1 min-w-[160px] space-y-1">
                <label className="text-xs text-muted-foreground">Name *</label>
                <Input className="h-8 text-sm" required value={m.fullName} onChange={e => updateFamilyMember(m.id, 'fullName', e.target.value)} aria-label="Family member name" />
              </div>
              <div className="w-16 space-y-1">
                <label className="text-xs text-muted-foreground">Age *</label>
                <Input type="number" min="0" className="h-8 text-sm" required value={m.age} onChange={e => updateFamilyMember(m.id, 'age', e.target.value === '' ? '' : Number(e.target.value))} aria-label="Family member age" />
              </div>
              <div className="w-28 space-y-1">
                <label className="text-xs text-muted-foreground">Relationship *</label>
                <select className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={m.relationship} onChange={e => updateFamilyMember(m.id, 'relationship', e.target.value)} aria-label="Family member relationship">
                  {['Spouse','Child','Parent','Sibling','Grandparent','Other'].map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[120px] space-y-1">
                <label className="text-xs text-muted-foreground">Occupation</label>
                <Input className="h-8 text-sm" value={m.occupation} onChange={e => updateFamilyMember(m.id, 'occupation', e.target.value)} aria-label="Family member occupation" />
              </div>
              <div className="w-28 space-y-1">
                <label className="text-xs text-muted-foreground">Status *</label>
                <select className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={m.status} onChange={e => updateFamilyMember(m.id, 'status', e.target.value)} aria-label="Family member status">
                  {['Employed','Self-Employed','Unemployed','Student','Retired','Dependent','OFW'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="w-28 space-y-1">
                <label className="text-xs text-muted-foreground">Monthly Income</label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₱</span>
                  <Input type="text" inputMode="numeric" className="h-8 text-sm pl-5" value={m.income} onChange={e => updateFamilyMember(m.id, 'income', e.target.value.replace(/,/g, ''))} onBlur={e => { const f = formatMoney(e.target.value); updateFamilyMember(m.id, 'income', f); }} aria-label="Family member income" />
                </div>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => removeFamilyMember(m.id)} className="text-destructive h-8">Remove</Button>
            </div>
          ))}
        </div>

        {/* Consent acknowledgment */}
        <div className="rounded-lg border bg-card p-6">
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={hasConsent} onChange={e => setHasConsent(e.target.checked)} className="mt-0.5 rounded border-input text-primary" />
            <span>I confirm the beneficiary has given consent per Data Privacy Act (RA 10173) and this data will be logged in the consent ledger</span>
          </label>
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting} aria-label="Submit Intake">
            {submitting ? 'Submitting...' : 'Submit Intake'}
          </Button>
        </div>
      </form>
    </PageShell>
  );
}
