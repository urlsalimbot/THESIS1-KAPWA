import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useIntakeAutosave, loadDraft, clearDraft } from '@/hooks/useIntakeAutosave';
import { useAuth } from '@/lib/auth-context';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { PageShell } from '@/components/PageShell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { IntakeAddressBlock } from '@/components/IntakeAddressBlock';
import type { AddressFields } from '@/components/IntakeAddressBlock';
import { CIVIL_STATUSES, NAME_EXTENSIONS, FAMILY_MEMBER_STATUSES } from '../lib/constants';
import { Check, UserCheck, User, Users, ShieldCheck, AlertCircle } from 'lucide-react';
import { validatePerson, type PersonFormValues, type ValidationErrors } from '@/hooks/useIntakeValidation';

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
  gender: string;
  dob: string;
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

const emptyAddress: AddressFields = { street: '', barangay: '', city: '0301413000', province: '0301400000', region: '03', postalCode: '3013', psgcCode: '' };

const emptyPerson = (): PersonForm => ({
  surname: '', firstName: '', middleName: '', extension: '',
  gender: '', dob: '', placeOfBirth: '', civilStatus: '',
  cellularNumber: '', email: '', currentAddress: { ...emptyAddress },
  philhealthNumber: '', occupation: '', estimatedMonthlyIncome: '',
});

function PersonFields({ prefix, form, onChange, onAddressChange, errors, showAge = true }: {
  prefix: string; form: PersonForm; onChange: (field: string, value: string) => void;
  onAddressChange: (type: 'currentAddress', field: string, value: string) => void;
  errors: ValidationErrors; showAge?: boolean;
}) {
  const { t } = useTranslation();
  function getError(field: string): string {
    return errors[`${prefix}.${field}`] || errors[field] || '';
  }

  function InputWithError({ field, children }: { field: string; children: React.ReactNode }) {
    const err = getError(field);
    return (
      <div>
        {children}
        {err && <p className="text-xs text-destructive mt-1">{err}</p>}
      </div>
    );
  }

  const age = computeAge(form.dob);
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-muted-foreground mb-2">{t('intake.clientName', 'Name of the Client')}</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <InputWithError field="surname">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('intake.surname', 'Surname *')}</label>
              <Input required value={form.surname} onChange={e => onChange('surname', e.target.value)} aria-label={`${prefix}-surname`} className={getError('surname') ? 'border-destructive' : ''} />
            </div>
          </InputWithError>
          <InputWithError field="firstName">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('intake.firstName', 'First Name *')}</label>
              <Input required value={form.firstName} onChange={e => onChange('firstName', e.target.value)} aria-label={`${prefix}-firstName`} className={getError('firstName') ? 'border-destructive' : ''} />
            </div>
          </InputWithError>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('intake.middleName', 'Middle Name')}</label>
            <Input value={form.middleName} onChange={e => onChange('middleName', e.target.value)} aria-label={`${prefix}-middleName`} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('intake.extension', 'Extension')}</label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={form.extension} onChange={e => onChange('extension', e.target.value)} aria-label={`${prefix}-extension`}>
              {NAME_EXTENSIONS.map(e => <option key={e} value={e === 'N/A' ? '' : e}>{e}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <InputWithError field="gender">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('intake.sex', 'Sex *')}</label>
            <div className="flex h-10 items-center gap-4">
              {['Male', 'Female'].map(s => (
                <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name={`${prefix}-gender`} value={s} checked={form.gender === s} onChange={e => onChange('gender', e.target.value)} className="text-primary" required />
                  {t(`intake.${s.toLowerCase()}`, s)}
                </label>
              ))}
            </div>
          </div>
        </InputWithError>
        {showAge && (
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('intake.age', 'Age')}</label>
            <Input type="number" value={age || ''} disabled aria-label={`${prefix}-age`} className="bg-muted" />
          </div>
        )}
        <InputWithError field="dob">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('intake.dateOfBirth', 'Date of Birth *')}</label>
            <Input type="date" required value={form.dob} onChange={e => onChange('dob', e.target.value)} aria-label={`${prefix}-dob`} className={`[&::-webkit-calendar-picker-indicator]:ml-auto [&::-webkit-calendar-picker-indicator]:opacity-60${getError('dob') ? ' border-destructive' : ''}`} />
          </div>
        </InputWithError>
        <InputWithError field="placeOfBirth">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('intake.placeOfBirth', 'Place of Birth *')}</label>
            <Input required value={form.placeOfBirth} onChange={e => onChange('placeOfBirth', e.target.value)} aria-label={`${prefix}-placeOfBirth`} className={getError('placeOfBirth') ? 'border-destructive' : ''} />
          </div>
        </InputWithError>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <InputWithError field="civilStatus">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('intake.civilStatus', 'Civil Status *')}</label>
            <select className={`flex h-10 w-full rounded-md border ${getError('civilStatus') ? 'border-destructive' : 'border-input'} bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`} required value={form.civilStatus} onChange={e => onChange('civilStatus', e.target.value)} aria-label={`${prefix}-civilStatus`}>
              <option value="">{t('intake.select', 'Select...')}</option>
              {CIVIL_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </InputWithError>
        <InputWithError field="cellularNumber">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('intake.cellularNumber', 'Cellular Number *')}</label>
            <Input type="tel" required value={form.cellularNumber} onChange={e => onChange('cellularNumber', e.target.value.replace(/\D/g, ''))} aria-label={`${prefix}-cellularNumber`} className={getError('cellularNumber') ? 'border-destructive' : ''} />
          </div>
        </InputWithError>
        <InputWithError field="email">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('intake.email', 'Email *')}</label>
            <Input type="email" value={form.email} onChange={e => onChange('email', e.target.value)} aria-label={`${prefix}-email`} placeholder="email@example.com" className={getError('email') ? 'border-destructive' : ''} />
          </div>
        </InputWithError>
      </div>

      <Separator />
      <IntakeAddressBlock value={form.currentAddress} onChange={(f, v) => onAddressChange('currentAddress', f, v)} label={t('intake.address', 'Address')} errors={errors} fieldPrefix={prefix} />

      <div className="space-y-2">
        <label className="text-sm font-medium">{t('intake.philhealthNumber', 'PhilHealth Number')}</label>
        <Input value={form.philhealthNumber} onChange={e => onChange('philhealthNumber', e.target.value)} aria-label={`${prefix}-philhealthNumber`} placeholder={t('intake.optional', 'Optional')} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <InputWithError field="occupation">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('intake.occupation', 'Occupation *')}</label>
            <Input required value={form.occupation} onChange={e => onChange('occupation', e.target.value)} aria-label={`${prefix}-occupation`} className={getError('occupation') ? 'border-destructive' : ''} />
          </div>
        </InputWithError>
        <InputWithError field="estimatedMonthlyIncome">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('intake.estimatedIncome', 'Estimated Monthly Income *')}</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₱</span>
              <Input type="text" inputMode="numeric" required value={form.estimatedMonthlyIncome} onChange={e => onChange('estimatedMonthlyIncome', e.target.value.replace(/\D/g, ''))} onBlur={e => { const v = e.target.value; if (v) onChange('estimatedMonthlyIncome', formatMoney(v)); }} aria-label={`${prefix}-income`} className={`pl-7${getError('estimatedMonthlyIncome') ? ' border-destructive' : ''}`} />
            </div>
          </div>
        </InputWithError>
      </div>
    </div>
  );
}

export function IntakePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const [beneficiary, setBeneficiary] = useState<PersonForm>(emptyPerson);
  const [claimant, setClaimant] = useState<PersonForm>(emptyPerson);
  const [relationshipToBeneficiary, setRelationshipToBeneficiary] = useState('');
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [beneficiaryIsClaimant, setBeneficiaryIsClaimant] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const [benErrors, setBenErrors] = useState<ValidationErrors>({});
  const [claimErrors, setClaimErrors] = useState<ValidationErrors>({});
  const [submittedCase, setSubmittedCase] = useState<{ caseId: string } | null>(null);
  const [batchSubmitting, setBatchSubmitting] = useState(false);

  const formSnapshot = useMemo(() => ({
    beneficiary,
    claimant,
    relationshipToBeneficiary,
    family,
    beneficiaryIsClaimant,
    hasConsent,
  }), [beneficiary, claimant, relationshipToBeneficiary, family, beneficiaryIsClaimant, hasConsent]);

  useIntakeAutosave(formSnapshot, userId);

  useEffect(() => {
    if (!userId) return;
    const draft = loadDraft(userId);
    if (draft?.data && !location.state?.prefill) {
      const d = draft.data as {
        beneficiary: PersonForm;
        claimant: PersonForm;
        relationshipToBeneficiary: string;
        family: FamilyMember[];
        beneficiaryIsClaimant: boolean;
        hasConsent: boolean;
      };
      setBeneficiary(d.beneficiary);
      setClaimant(d.claimant);
      setRelationshipToBeneficiary(d.relationshipToBeneficiary);
      setFamily(d.family ?? []);
      setBeneficiaryIsClaimant(d.beneficiaryIsClaimant);
      setHasConsent(d.hasConsent);
    }
  }, [userId]);

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
    setError('');
    setBenErrors(prev => {
      const next = { ...prev };
      delete next[`ben.${field}`];
      return next;
    });
  }

  function updateClaimant(field: string, value: string) {
    setClaimant(prev => ({ ...prev, [field]: value }));
    setError('');
    setClaimErrors(prev => {
      const next = { ...prev };
      delete next[`claim.${field}`];
      return next;
    });
  }

  function updateBenAddress(type: 'currentAddress', field: string, value: string) {
    setBeneficiary(prev => ({ ...prev, [type]: { ...prev[type], [field]: value } }));
    setError('');
    setBenErrors(prev => {
      const next = { ...prev };
      delete next[`ben.${field}`];
      return next;
    });
  }

  function updateClaimAddress(type: 'currentAddress', field: string, value: string) {
    setClaimant(prev => ({ ...prev, [type]: { ...prev[type], [field]: value } }));
    setError('');
    setClaimErrors(prev => {
      const next = { ...prev };
      delete next[`claim.${field}`];
      return next;
    });
  }

  function addFamilyMember() {
    setFamily(prev => [...prev, {
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      surname: '', firstName: '', middleName: '', extension: '',
      gender: '', dob: '',
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

  function familyMembersPayload() {
    return family.filter(m => m.surname.trim()).map(f => ({
      surname: f.surname,
      firstName: f.firstName,
      middleName: f.middleName || undefined,
      extension: f.extension || undefined,
      gender: f.gender,
      dob: f.dob,
      age: computeAge(f.dob),
      relationship: f.relationship,
      occupation: f.occupation,
      income: f.income ? parseFloat(f.income.replace(/,/g, '')) : undefined,
      status: f.status || undefined,
    }));
  }

  function completeIntake(caseId: string) {
    if (family.some(m => m.surname.trim())) {
      setSubmittedCase({ caseId });
    } else {
      navigate(`/cases/${caseId}`);
    }
  }

  async function handleBatchSubmit() {
    if (!submittedCase) return;
    setBatchSubmitting(true);
    setError('');
    try {
      await api.post('/intake/batch-family', {
        caseId: submittedCase.caseId,
        primary: personToPayload(beneficiary),
        members: familyMembersPayload(),
      });
      navigate(`/cases/${submittedCase.caseId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('intake.batchSubmitFailed', 'Failed to submit batch family intake'));
    } finally {
      setBatchSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const toValidate = (form: PersonForm): PersonFormValues => ({
      ...form,
      street: form.currentAddress.street,
      barangay: form.currentAddress.barangay,
      city: form.currentAddress.city,
      province: form.currentAddress.province,
      region: form.currentAddress.region,
      postalCode: form.currentAddress.postalCode,
    });

    const benVals = toValidate(beneficiary);
    const rawBenErrs = validatePerson(benVals);
    const benErrs: ValidationErrors = {};
    for (const [k, v] of Object.entries(rawBenErrs)) benErrs[`ben.${k}`] = v;
    setBenErrors(benErrs);

    let claimErrs: ValidationErrors = {};
    if (!beneficiaryIsClaimant) {
      const claimVals = toValidate(claimant);
      const rawClaimErrs = validatePerson(claimVals);
      for (const [k, v] of Object.entries(rawClaimErrs)) claimErrs[`claim.${k}`] = v;
      setClaimErrors(claimErrs);
    }

    const allErrors = { ...benErrs, ...claimErrs };
    if (Object.keys(allErrors).length > 0) {
      setError(t('intake.fixHighlighted', 'Please fix the highlighted fields below.'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!beneficiaryIsClaimant && !relationshipToBeneficiary) {
      setError(t('intake.claimantRelationshipRequired', 'Please specify claimant relationship to beneficiary'));
      return;
    }
    if (!hasConsent) {
      setError(t('intake.consentRequired', 'Consent required per Data Privacy Act (RA 10173)'));
      return;
    }

    setSubmitting(true);

    const intakePayload = {
      beneficiary: personToPayload(beneficiary),
      claimant: beneficiaryIsClaimant
        ? { ...personToPayload(beneficiary), relationshipToBeneficiary: 'Self' }
        : { ...personToPayload(claimant), relationshipToBeneficiary },
      familyMembers: familyMembersPayload(),
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
        clearDraft(userId);
        navigate('/intake/review', {
          state: { candidates: matchResult.candidates, intakeData: intakePayload },
        });
      } else {
        clearDraft(userId);
        const data = await api.post<{ caseId: string; controlNo: string }>('/intake', intakePayload);
        completeIntake(data.caseId);
      }
    } catch (err: unknown) {
      try {
        clearDraft(userId);
        const data = await api.post<{ caseId: string; controlNo: string }>('/intake', intakePayload);
        completeIntake(data.caseId);
      } catch (fallbackErr: unknown) {
        setError(fallbackErr instanceof Error ? fallbackErr.message : t('intake.submitFailed', 'Failed to submit intake'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell title={t('intake.title', 'General Intake Form')} description={t('intake.description', 'Client Registration — Beneficiary + Claimant + Family Composition')}>
      {error && (
        <div className="mb-4 rounded border border-destructive bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}
      {(location.state as { prefill?: Record<string, string> })?.prefill && (
        <div className="mb-4 rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          {t('intake.addingCaseFor', 'Adding a case for')} <strong>{beneficiary.surname}, {beneficiary.firstName}</strong>{t('intake.addingCaseForSuffix', '. Review and modify details before submitting.')}
        </div>
      )}
      <form onSubmit={handleSubmit} noValidate className="max-w-6xl mx-auto space-y-6">
        {/* Section I: Beneficiary */}
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
            <User size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold">{t('intake.sectionBeneficiary', 'I. Beneficiary Information')}</h2>
          </div>
          <div className="p-6">
            <PersonFields prefix="ben" form={beneficiary} onChange={updateBeneficiary} onAddressChange={updateBenAddress} errors={benErrors} />
          </div>
        </div>

        {/* Section II: Claimant */}
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
            <UserCheck size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold">{t('intake.sectionClaimant', 'II. Claimant Information')}</h2>
            <div className="ml-auto">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={beneficiaryIsClaimant}
                  onChange={e => {
                    setBeneficiaryIsClaimant(e.target.checked);
                    setError('');
                    if (e.target.checked) {
                      setClaimant(emptyPerson);
                      setRelationshipToBeneficiary('');
                      setClaimErrors({});
                    }
                  }}
                  className="rounded border-input text-primary"
                />
                <UserCheck size={14} className="text-muted-foreground" />
                <span className="text-muted-foreground">{t('intake.beneficiaryIsClaimant', 'Beneficiary is claimant')}</span>
              </label>
            </div>
          </div>
          <div className="p-6">
            {beneficiaryIsClaimant ? (
              <p className="text-sm text-muted-foreground italic">{t('intake.claimantMirror', 'Claimant details will mirror the beneficiary.')}</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-4">{t('intake.authorizedToClaim', 'The person authorized to claim on behalf of the beneficiary.')}</p>
                <PersonFields prefix="claim" form={claimant} onChange={updateClaimant} onAddressChange={updateClaimAddress} errors={claimErrors} />
                <div className="mt-4 space-y-2">
                  <label className="text-sm font-medium">{t('intake.relationshipToBeneficiary', 'Relationship to Beneficiary *')}</label>
                  <select className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" required value={relationshipToBeneficiary} onChange={e => setRelationshipToBeneficiary(e.target.value)} aria-label={t('intake.relationshipToBeneficiary', 'Relationship to beneficiary')}>
                    <option value="">{t('intake.select', 'Select...')}</option>
                    {['Spouse', 'Child', 'Parent', 'Sibling', 'Legal Guardian', 'Relative', 'Unrelated Caretaker'].map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Section III: Family Composition */}
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
            <Users size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold">{t('intake.sectionFamily', 'III. Family Composition')}</h2>
            <div className="ml-auto">
              <Button type="button" variant="outline" size="sm" onClick={addFamilyMember}>{t('intake.addMember', '+ Add Member')}</Button>
            </div>
          </div>
          <div className="p-6">
            {family.length === 0 && <p className="text-sm text-muted-foreground italic">{t('intake.noFamilyMembers', 'No family members added')}</p>}
            {family.map(m => {
              const dobError = m.dob && (!/^\d{4}-\d{2}-\d{2}$/.test(m.dob) || computeAge(m.dob) < 0 || computeAge(m.dob) > 120) ? t('intake.invalidDob', 'Invalid date of birth') : '';
              return (
                <div key={m.id} className={`mb-3 rounded-lg border p-3 transition-colors ${m.done ? 'bg-green-50 border-green-300' : 'bg-muted/30'}`}>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">{t('intake.surname', 'Surname *')}</label>
                      <Input className="h-8 text-sm" required value={m.surname} onChange={e => updateFamilyMember(m.id, 'surname', e.target.value)} aria-label="FM surname" disabled={m.done} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">{t('intake.firstName', 'First Name *')}</label>
                      <Input className="h-8 text-sm" required value={m.firstName} onChange={e => updateFamilyMember(m.id, 'firstName', e.target.value)} aria-label="FM first name" disabled={m.done} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">{t('intake.middleName', 'Middle Name')}</label>
                      <Input className="h-8 text-sm" value={m.middleName} onChange={e => updateFamilyMember(m.id, 'middleName', e.target.value)} aria-label="FM middle name" disabled={m.done} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">{t('intake.ext', 'Ext')}</label>
                      <select className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={m.extension} onChange={e => updateFamilyMember(m.id, 'extension', e.target.value)} aria-label="FM extension" disabled={m.done}>
                        {NAME_EXTENSIONS.map(e => <option key={e} value={e === 'N/A' ? '' : e}>{e}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">{t('intake.sex', 'Sex *')}</label>
                      <div className="flex gap-3 h-8 items-center">
                        {(['Male', 'Female'] as const).map(s => (
                          <label key={s} className="flex items-center gap-1 text-sm cursor-pointer">
                            <input type="radio" name={`fm-${m.id}-gender`} value={s} checked={m.gender === s} onChange={() => updateFamilyMember(m.id, 'gender', s)} aria-label="FM gender" disabled={m.done} />
                            {t(`intake.${s.toLowerCase()}`, s)}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">{t('intake.dateOfBirth', 'Date of Birth *')}</label>
                      <Input type="date" className="h-8 text-sm" required value={m.dob} onChange={e => updateFamilyMember(m.id, 'dob', e.target.value)} aria-label="FM dob" disabled={m.done} />
                      {dobError && <p className="text-xs text-destructive mt-1">{dobError}</p>}
                      {!dobError && m.dob && <p className="text-xs text-muted-foreground mt-1">{t('intake.ageLabel', 'Age: {{age}}', { age: computeAge(m.dob) })}</p>}
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">{t('intake.relationship', 'Relationship *')}</label>
                      <select className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={m.relationship} onChange={e => updateFamilyMember(m.id, 'relationship', e.target.value)} aria-label="FM relationship" disabled={m.done}>
                        {['Spouse','Child','Parent','Sibling','Grandparent','Other'].map(r => <option key={r}>{r}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">{t('intake.occupation', 'Occupation')}</label>
                      <Input className="h-8 text-sm" value={m.occupation} onChange={e => updateFamilyMember(m.id, 'occupation', e.target.value)} aria-label="FM occupation" disabled={m.done} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">{t('intake.status', 'Status *')}</label>
                      <select className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={m.status} onChange={e => updateFamilyMember(m.id, 'status', e.target.value)} aria-label="FM status" disabled={m.done}>
                        {FAMILY_MEMBER_STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">{t('intake.monthlyIncome', 'Monthly Income')}</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₱</span>
                        <Input type="text" inputMode="numeric" className="h-8 text-sm pl-5" value={m.income} onChange={e => updateFamilyMember(m.id, 'income', e.target.value.replace(/\D/g, ''))} onBlur={e => { const v = e.target.value; if (v) updateFamilyMember(m.id, 'income', formatMoney(v)); }} aria-label="FM income" disabled={m.done} />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant={m.done ? 'secondary' : 'default'} size="sm" onClick={() => toggleDone(m.id)} disabled={!m.done && (!m.surname || !m.firstName || !m.gender || !m.dob || !!dobError || !m.relationship || !m.status)} className="h-8 gap-1">
                      <Check size={14} />
                      {m.done ? t('intake.edit', 'Edit') : t('intake.done', 'Done')}
                    </Button>
                    {!m.done && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeFamilyMember(m.id)} className="text-destructive h-8">{t('intake.remove', 'Remove')}</Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Data Privacy Consent */}
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
            <ShieldCheck size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold">{t('intake.dataPrivacyConsent', 'Data Privacy Consent')}</h2>
          </div>
          <div className="p-6">
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={hasConsent} onChange={e => { setHasConsent(e.target.checked); setError(''); }} className="mt-0.5 rounded border-input text-primary" />
              <span>{t('intake.consentText', 'I confirm the beneficiary has given consent per Data Privacy Act (RA 10173) and this data will be logged in the consent ledger')}</span>
            </label>
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting} aria-label={t('intake.submitIntake', 'Submit Intake')}>
            {submitting ? t('intake.checkingRecords', 'Checking records...') : t('intake.submitCheck', 'Submit & Check for Prior Records')}
          </Button>
        </div>
      </form>

      {submittedCase && (
        <div className="mt-6 max-w-6xl mx-auto rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold">{t('intake.addAnotherBatch', 'Add another family member as a batch?')}</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('intake.batchMembers', 'Submit {{count}} member(s) together with this household in one flow.', { count: family.filter(m => m.surname.trim()).length })}
          </p>
          <div className="mt-4 flex gap-3">
            <Button type="button" onClick={handleBatchSubmit} disabled={batchSubmitting} aria-label={t('intake.yesAddBatch', 'Yes, add as batch')}>
              {batchSubmitting ? t('intake.addingMembers', 'Adding members...') : t('intake.yesAddBatch', 'Yes, add as batch')}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(`/cases/${submittedCase.caseId}`)}>
              {t('intake.noViewCase', 'No, view case')}
            </Button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
