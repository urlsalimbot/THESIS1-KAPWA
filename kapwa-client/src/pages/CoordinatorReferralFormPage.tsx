import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/errors';
import { NAME_EXTENSIONS } from '../lib/constants';
import { User, MapPin, FileText, Phone, Send } from 'lucide-react';

export function CoordinatorReferralFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    surname: '', firstName: '', middleName: '', extension: '',
    gender: '', dob: '', phone: '', street: '', barangay: '',
    reason: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.surname || !form.firstName || !form.gender || !form.dob || !form.reason) {
      setError(t('coordinator.fillRequired', 'Please fill in all required fields'));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/referrals', {
        surname: form.surname,
        firstName: form.firstName,
        middleName: form.middleName || undefined,
        extension: form.extension || undefined,
        gender: form.gender,
        dob: form.dob,
        phone: form.phone || undefined,
        address: { street: form.street, barangay: form.barangay },
        reason: form.reason,
      });
      toast.success(t('coordinator.submitted', 'Referral submitted'), { description: t('coordinator.submittedDesc', 'Resident has been referred to MSWDO for assessment.') });
      navigate('/coordinator/referrals');
    } catch (err: any) {
      setError(err?.message || t('coordinator.submitFailed', 'Failed to submit referral'));
      toast.error(t('coordinator.submitFailed', 'Could not submit referral'), { description: humanizeError(err) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell title={t('coordinator.newReferral', 'New Referral')} description={t('coordinator.formDescription', 'Refer a barangay resident to MSWDO for assessment.')}>
      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <span className="size-4 rounded-full bg-destructive/20 flex items-center justify-center text-[10px] font-bold shrink-0">!</span> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="max-w-2xl mx-auto space-y-6">
        {/* Personal Information */}
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
            <User size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">{t('coordinator.personalInfo', 'Personal Information')}</h2>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <span className="text-xs text-muted-foreground font-medium">{t('coordinator.residentName', 'Name of the Resident')}</span>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-2">
                <div className="space-y-1.5">
                  <label htmlFor="crf-surname" className="text-xs text-muted-foreground font-medium">{t('coordinator.surname', 'Surname *')}</label>
                  <Input id="crf-surname" className="h-9" required value={form.surname} onChange={e => update('surname', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="crf-firstName" className="text-xs text-muted-foreground font-medium">{t('coordinator.firstName', 'First Name *')}</label>
                  <Input id="crf-firstName" className="h-9" required value={form.firstName} onChange={e => update('firstName', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="crf-middleName" className="text-xs text-muted-foreground font-medium">{t('coordinator.middleName', 'Middle Name')}</label>
                  <Input id="crf-middleName" className="h-9" value={form.middleName} onChange={e => update('middleName', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="crf-extension" className="text-xs text-muted-foreground font-medium">{t('coordinator.extension', 'Extension')}</label>
                  <Select value={form.extension} onValueChange={v => update('extension', v)}>
                    <SelectTrigger id="crf-extension" className="h-9">
                      <SelectValue placeholder={t('coordinator.na', 'N/A')} />
                    </SelectTrigger>
                    <SelectContent>
                      {/* 'N/A' is the placeholder (the empty value), so it is
                          excluded here — a Radix SelectItem may not use ''. */}
                      {NAME_EXTENSIONS.filter(e => e !== 'N/A').map(e => (
                        <SelectItem key={e} value={e}>{e}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <fieldset className="space-y-1.5">
                <legend className="text-xs text-muted-foreground font-medium">{t('coordinator.sex', 'Sex *')}</legend>
                <div className="flex h-9 items-center gap-4">
                  {['Male', 'Female'].map(s => (
                    <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" name="gender" value={s} checked={form.gender === s} onChange={e => update('gender', e.target.value)} className="text-primary" required />
                      {t(`coordinator.${s.toLowerCase()}`, s)}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="space-y-1.5">
                <label htmlFor="crf-dob" className="text-xs text-muted-foreground font-medium">{t('coordinator.dateOfBirth', 'Date of Birth *')}</label>
                <Input id="crf-dob" className="h-9" type="date" required value={form.dob} onChange={e => update('dob', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="crf-phone" className="text-xs text-muted-foreground font-medium">{t('coordinator.phone', 'Phone')}</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input id="crf-phone" className="h-9 pl-9" type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="0917XXX-XXXX" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
            <MapPin size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">{t('coordinator.address', 'Address')}</h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="crf-street" className="text-xs text-muted-foreground font-medium">{t('coordinator.street', 'Street / Purok')}</label>
                <Input id="crf-street" className="h-9" value={form.street} onChange={e => update('street', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="crf-barangay" className="text-xs text-muted-foreground font-medium">{t('coordinator.barangay', 'Barangay')}</label>
                <Input id="crf-barangay" className="h-9" value={form.barangay} onChange={e => update('barangay', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* Referral Details */}
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
            <FileText size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">{t('coordinator.referralDetails', 'Referral Details')}</h2>
          </div>
          <div className="p-4 space-y-1.5">
            <label htmlFor="crf-reason" className="text-xs text-muted-foreground font-medium">{t('coordinator.reasonForReferral', 'Reason for Referral *')}</label>
            <Textarea id="crf-reason" required value={form.reason} onChange={e => update('reason', e.target.value)} placeholder={t('coordinator.reasonPlaceholder', 'Describe why this resident is being referred to MSWDO...')} />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={submitting}>
            <Send size={14} className="mr-1" /> {submitting ? t('coordinator.submitting', 'Submitting...') : t('coordinator.submitReferral', 'Submit Referral')}
          </Button>
        </div>
      </form>
    </PageShell>
  );
}
