import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { PageShell } from '@/components/PageShell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { IntakeAddressBlock } from '@/components/IntakeAddressBlock';
import type { AddressFields } from '@/components/IntakeAddressBlock';
import { CIVIL_STATUSES, NAME_EXTENSIONS, FAMILY_MEMBER_STATUSES } from '../lib/constants';
import { Check, UserCheck } from 'lucide-react';

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
  surname: string;
  firstName: string;
  middleName: string;
  extension: string;
  age: number | '';
  relationship: string;
  occupation: string;
  income: string;
  status: string;
  done: boolean;
}

interface PersonForm {
  surname: string; firstName: string; middleName: string; extension: string;
  gender: string; dob: string; placeOfBirth: string; civilStatus: string;
  cellularNumber: string; email: string; currentAddress: AddressFields;
  philhealthNumber: string; occupation: string; estimatedMonthlyIncome: string;
}

const emptyAddress: AddressFields = { street: '', barangay: '', city: '', province: '0301400000', region: '03', postalCode: '', psgcCode: '' };

const emptyPerson = (): PersonForm => ({
  surname: '', firstName: '', middleName: '', extension: '',
  gender: '', dob: '', placeOfBirth: '', civilStatus: '',
  cellularNumber: '', email: '', currentAddress: { ...emptyAddress },
  philhealthNumber: '', occupation: '', estimatedMonthlyIncome: '',
});

function PersonFields({ prefix, form, onChange, onAddressChange, showAge = true }: {
  prefix: string; form: PersonForm; onChange: (field: string, value: string) => void;
  onAddressChange: (type: 'currentAddress', field: string, value: string) => void;
  showAge?: boolean;
}) {
  const age = computeAge(form.dob);
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-muted-foreground mb-2">Name of the Client</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Surname *</label>
            <Input required value={form.surname} onChange={e => onChange('surname', e.target.value)} aria-label={`${prefix}-surname`} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">First Name *</label>
            <Input required value={form.firstName} onChange={e => onChange('firstName', e.target.value)} aria-label={`${prefix}-firstName`} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Middle Name</label>
            <Input value={form.middleName} onChange={e => onChange('middleName', e.target.value)} aria-label={`${prefix}-middleName`} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Extension</label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={form.extension} onChange={e => onChange('extension', e.target.value)} aria-label={`${prefix}-extension`}>
              {NAME_EXTENSIONS.map(e => <option key={e} value={e === 'N/A' ? '' : e}>{e}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Sex *</label>
          <div className={showAge ? 'flex h-10 items-center gap-4' : 'flex h-10 items-center gap-4'}>
            {['Male', 'Female'].map(s => (
              <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name={`${prefix}-gender`} value={s} checked={form.gender === s} onChange={e => onChange('gender', e.target.value)} className="text-primary" required />
                {s}
              </label>
            ))}
          </div>
        </div>
        {showAge && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Age</label>
            <Input type="number" value={age || ''} disabled aria-label={`${prefix}-age`} className="bg-muted" />
          </div>
        )}
        <div className="space-y-2">
          <label className="text-sm font-medium">Date of Birth *</label>
          <Input type="date" required value={form.dob} onChange={e => onChange('dob', e.target.value)} aria-label={`${prefix}-dob`} className="[&::-webkit-calendar-picker-indicator]:ml-auto [&::-webkit-calendar-picker-indicator]:opacity-60" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Place of Birth *</label>
          <Input required value={form.placeOfBirth} onChange={e => onChange('placeOfBirth', e.target.value)} aria-label={`${prefix}-placeOfBirth`} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Civil Status *</label>
          <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" required value={form.civilStatus} onChange={e => onChange('civilStatus', e.target.value)} aria-label={`${prefix}-civilStatus`}>
            <option value="">Select...</option>
            {CIVIL_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Cellular Number *</label>
          <Input type="tel" required value={form.cellularNumber} onChange={e => onChange('cellularNumber', e.target.value.replace(/\D/g, ''))} aria-label={`${prefix}-cellularNumber`} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Email {prefix === 'claim' || prefix === 'ben' ? '*' : ''}</label>
          <Input type="email" value={form.email} onChange={e => onChange('email', e.target.value)} aria-label={`${prefix}-email`} placeholder="email@example.com" />
        </div>
      </div>

      <Separator />
      <IntakeAddressBlock value={form.currentAddress} onChange={(f, v) => onAddressChange('currentAddress', f, v)} label="Address" />

      <div className="space-y-2">
        <label className="text-sm font-medium">PhilHealth Number</label>
        <Input value={form.philhealthNumber} onChange={e => onChange('philhealthNumber', e.target.value)} aria-label={`${prefix}-philhealthNumber`} placeholder="Optional" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Occupation *</label>
          <Input required value={form.occupation} onChange={e => onChange('occupation', e.target.value)} aria-label={`${prefix}-occupation`} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Estimated Monthly Income *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₱</span>
            <Input type="text" inputMode="numeric" required value={form.estimatedMonthlyIncome} onChange={e => onChange('estimatedMonthlyIncome', e.target.value.replace(/\D/g, ''))} onBlur={e => { const v = e.target.value; if (v) onChange('estimatedMonthlyIncome', formatMoney(v)); }} aria-label={`${prefix}-income`} className="pl-7" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function IntakePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [beneficiary, setBeneficiary] = useState<PersonForm>(emptyPerson);
  const [claimant, setClaimant] = useState<PersonForm>(emptyPerson);
  const [relationshipToBeneficiary, setRelationshipToBeneficiary] = useState('');
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [beneficiaryIsClaimant, setBeneficiaryIsClaimant] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);

  useEffect(() => {
    const prefill = (location.state as { prefill?: Record<string, string> })?.prefill;
    if (prefill) {
      setBeneficiary(prev => ({
        ...prev,
        surname: prefill.surname ?? prev.surname,
        firstName: prefill.firstName ?? prev.firstName,
        middleName: prefill.middleName ?? prev.middleName,
        gender: prefill.gender ?? prev.gender,
        dob: prefill.dob ?? prev.dob,
        placeOfBirth: prefill.placeOfBirth ?? prev.placeOfBirth,
        civilStatus: prefill.civilStatus ?? prev.civilStatus,
        cellularNumber: prefill.cellularNumber ?? prev.cellularNumber,
        occupation: prefill.occupation ?? prev.occupation,
        estimatedMonthlyIncome: prefill.estimatedMonthlyIncome ?? prev.estimatedMonthlyIncome,
        philhealthNumber: prefill.philhealthNumber ?? prev.philhealthNumber,
      }));
    }
  }, [location.state]);

  function updateBeneficiary(field: string, value: string) {
    setBeneficiary(prev => ({ ...prev, [field]: value }));
  }

  function updateClaimant(field: string, value: string) {
    setClaimant(prev => ({ ...prev, [field]: value }));
  }

  function updateBenAddress(type: 'currentAddress', field: string, value: string) {
    setBeneficiary(prev => ({ ...prev, [type]: { ...prev[type], [field]: value } }));
  }

  function updateClaimAddress(type: 'currentAddress', field: string, value: string) {
    setClaimant(prev => ({ ...prev, [type]: { ...prev[type], [field]: value } }));
  }

  function addFamilyMember() {
    setFamily(prev => [...prev, {
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      surname: '', firstName: '', middleName: '', extension: '',
      age: '' as const,
      relationship: 'Spouse',
      occupation: '',
      income: '',
      status: 'Employed',
      done: false,
    }]);
  }

  function updateFamilyMember(id: string, field: string, value: string | number) {
    setFamily(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
  }

  function toggleDone(id: string) {
    setFamily(prev => prev.map(m => m.id === id ? { ...m, done: !m.done } : m));
  }

  function removeFamilyMember(id: string) {
    setFamily(prev => prev.filter(m => m.id !== id));
  }

  function personToPayload(form: PersonForm) {
    return {
      surname: form.surname,
      firstName: form.firstName,
      middleName: form.middleName || undefined,
      extension: form.extension || undefined,
      gender: form.gender,
      dob: form.dob,
      age: computeAge(form.dob),
      placeOfBirth: form.placeOfBirth,
      civilStatus: form.civilStatus,
      cellularNumber: form.cellularNumber,
      email: form.email || undefined,
      currentAddress: form.currentAddress,
      philhealthNumber: form.philhealthNumber || undefined,
      occupation: form.occupation,
      estimatedMonthlyIncome: parseFloat(form.estimatedMonthlyIncome.replace(/,/g, '')) || 0,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const req = ['surname', 'firstName', 'dob', 'gender', 'placeOfBirth', 'civilStatus', 'cellularNumber', 'occupation', 'estimatedMonthlyIncome'];
    for (const f of req) {
      if (!(beneficiary as any)[f]) { setError('Please fill in all required beneficiary fields'); return; }
    }
    if (!beneficiaryIsClaimant) {
      for (const f of req) {
        if (!(claimant as any)[f]) { setError('Please fill in all required claimant fields'); return; }
      }
    }
    if (!beneficiary.email) { setError('Beneficiary email is required when beneficiary is claimant'); return; }
    if (!beneficiaryIsClaimant && !claimant.email) { setError('Claimant email is required'); return; }
    if (!beneficiaryIsClaimant && !relationshipToBeneficiary) { setError('Please specify claimant relationship to beneficiary'); return; }
    if (!hasConsent) { setError('Consent required per Data Privacy Act (RA 10173)'); return; }

    setSubmitting(true);

    const intakePayload = {
      beneficiary: personToPayload(beneficiary),
      claimant: beneficiaryIsClaimant
        ? { ...personToPayload(beneficiary), relationshipToBeneficiary: 'Self' }
        : { ...personToPayload(claimant), relationshipToBeneficiary },
      familyMembers: family.filter(m => m.surname.trim()).map(f => ({
        surname: f.surname,
        firstName: f.firstName,
        middleName: f.middleName || undefined,
        extension: f.extension || undefined,
        age: f.age || 0,
        relationship: f.relationship,
        occupation: f.occupation,
        income: f.income ? parseFloat(f.income.replace(/,/g, '')) : undefined,
        status: f.status || undefined,
      })),
      case: {},
    };

    try {
      const matchResult = await api.post<{ candidates: unknown[] }>('/intake/match-check', {
        surname: beneficiary.surname,
        firstName: beneficiary.firstName,
        middleName: beneficiary.middleName || undefined,
        familyMembers: family.filter(m => m.surname.trim()).map(f => ({ surname: f.surname, firstName: f.firstName })),
        barangay: beneficiary.currentAddress.barangay || undefined,
      });

      if (matchResult.candidates && matchResult.candidates.length > 0) {
        navigate('/intake/review', {
          state: { candidates: matchResult.candidates, intakeData: intakePayload },
        });
      } else {
        const data = await api.post<{ caseId: string; controlNo: string }>('/intake', intakePayload);
        navigate(`/cases/${data.caseId}`);
      }
    } catch (err: unknown) {
      try {
        const data = await api.post<{ caseId: string; controlNo: string }>('/intake', intakePayload);
        navigate(`/cases/${data.caseId}`);
      } catch (fallbackErr: unknown) {
        setError(fallbackErr instanceof Error ? fallbackErr.message : 'Failed to submit intake');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell title="General Intake Form" description="Client Registration — Beneficiary + Claimant + Family Composition">
      {error && <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {(location.state as { prefill?: Record<string, string> })?.prefill && (
        <div className="mb-4 rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          Adding a case for <strong>{beneficiary.surname}, {beneficiary.firstName}</strong>. Review and modify details before submitting.
        </div>
      )}
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
        {/* Section I: Beneficiary */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground">I. Beneficiary Information</h2>
          <PersonFields prefix="ben" form={beneficiary} onChange={updateBeneficiary} onAddressChange={updateBenAddress} />
        </div>

        {/* Section II: Claimant */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">II. Claimant Information</h2>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={beneficiaryIsClaimant}
                onChange={e => {
                  setBeneficiaryIsClaimant(e.target.checked);
                  if (e.target.checked) {
                    setClaimant(emptyPerson);
                    setRelationshipToBeneficiary('');
                  }
                }}
                className="rounded border-input text-primary"
              />
              <UserCheck size={14} className="text-muted-foreground" />
              <span className="text-muted-foreground">Beneficiary is claimant</span>
            </label>
          </div>
          {beneficiaryIsClaimant ? (
            <p className="text-sm text-muted-foreground italic">Claimant details will mirror the beneficiary.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-4">The person authorized to claim on behalf of the beneficiary.</p>
              <PersonFields prefix="claim" form={claimant} onChange={updateClaimant} onAddressChange={updateClaimAddress} />
              <div className="mt-4 space-y-2">
                <label className="text-sm font-medium">Relationship to Beneficiary *</label>
                <select className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" required value={relationshipToBeneficiary} onChange={e => setRelationshipToBeneficiary(e.target.value)} aria-label="Relationship to beneficiary">
                  <option value="">Select...</option>
                  {['Spouse', 'Child', 'Parent', 'Sibling', 'Legal Guardian', 'Relative', 'Unrelated Caretaker'].map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
            </>
          )}
        </div>

        {/* Section III: Family Composition */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">III. Family Composition</h2>
            <Button type="button" variant="outline" size="sm" onClick={addFamilyMember}>+ Add Member</Button>
          </div>
          {family.length === 0 && <p className="text-sm text-muted-foreground italic">No family members added</p>}
          {family.map(m => (
            <div key={m.id} className={`mb-3 rounded-lg border p-3 transition-colors ${m.done ? 'bg-green-50 border-green-300' : 'bg-muted/30'}`}>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Surname *</label>
                  <Input className="h-8 text-sm" required value={m.surname} onChange={e => updateFamilyMember(m.id, 'surname', e.target.value)} aria-label="FM surname" disabled={m.done} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">First Name *</label>
                  <Input className="h-8 text-sm" required value={m.firstName} onChange={e => updateFamilyMember(m.id, 'firstName', e.target.value)} aria-label="FM first name" disabled={m.done} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Middle Name</label>
                  <Input className="h-8 text-sm" value={m.middleName} onChange={e => updateFamilyMember(m.id, 'middleName', e.target.value)} aria-label="FM middle name" disabled={m.done} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Ext</label>
                  <select className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={m.extension} onChange={e => updateFamilyMember(m.id, 'extension', e.target.value)} aria-label="FM extension" disabled={m.done}>
                    {NAME_EXTENSIONS.map(e => <option key={e} value={e === 'N/A' ? '' : e}>{e}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Age *</label>
                  <Input type="number" min="0" className="h-8 text-sm" required value={m.age} onChange={e => updateFamilyMember(m.id, 'age', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} aria-label="FM age" disabled={m.done} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Relationship *</label>
                  <select className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={m.relationship} onChange={e => updateFamilyMember(m.id, 'relationship', e.target.value)} aria-label="FM relationship" disabled={m.done}>
                    {['Spouse','Child','Parent','Sibling','Grandparent','Other'].map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Occupation</label>
                  <Input className="h-8 text-sm" value={m.occupation} onChange={e => updateFamilyMember(m.id, 'occupation', e.target.value)} aria-label="FM occupation" disabled={m.done} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Status *</label>
                  <select className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={m.status} onChange={e => updateFamilyMember(m.id, 'status', e.target.value)} aria-label="FM status" disabled={m.done}>
                    {FAMILY_MEMBER_STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Monthly Income</label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₱</span>
                    <Input type="text" inputMode="numeric" className="h-8 text-sm pl-5" value={m.income} onChange={e => updateFamilyMember(m.id, 'income', e.target.value.replace(/\D/g, ''))} onBlur={e => { const v = e.target.value; if (v) updateFamilyMember(m.id, 'income', formatMoney(v)); }} aria-label="FM income" disabled={m.done} />
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant={m.done ? 'secondary' : 'default'} size="sm" onClick={() => toggleDone(m.id)} disabled={!m.done && (!m.surname || !m.firstName || !m.age || !m.relationship || !m.status)} className="h-8 gap-1">
                  <Check size={14} />
                  {m.done ? 'Edit' : 'Done'}
                </Button>
                {!m.done && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeFamilyMember(m.id)} className="text-destructive h-8">Remove</Button>
                )}
              </div>
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
            {submitting ? 'Checking records...' : 'Submit & Check for Prior Records'}
          </Button>
        </div>
      </form>
    </PageShell>
  );
}
