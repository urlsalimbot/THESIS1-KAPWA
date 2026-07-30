import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { User, MapPin, FileText, Phone, Send } from 'lucide-react';

export function CoordinatorReferralFormPage() {
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
      setError('Please fill in all required fields');
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
      toast.success('Referral submitted', { description: 'Resident has been referred to MSWDO for assessment.' });
      navigate('/coordinator/referrals');
    } catch (err: any) {
      setError(err?.message || 'Failed to submit referral');
      toast.error('Failed to submit referral', { description: err?.message || 'Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell title="New Referral" description="Refer a barangay resident to MSWDO for assessment.">
      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <span className="size-4 rounded-full bg-destructive/20 flex items-center justify-center text-[10px] font-bold shrink-0">!</span> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
        {/* Personal Information */}
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
            <User size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Personal Information</h2>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <span className="text-xs text-muted-foreground font-medium">Name of the Resident</span>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-2">
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground font-medium">Surname *</span>
                  <Input className="h-9" required value={form.surname} onChange={e => update('surname', e.target.value)} aria-label="surname" />
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground font-medium">First Name *</span>
                  <Input className="h-9" required value={form.firstName} onChange={e => update('firstName', e.target.value)} aria-label="firstName" />
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground font-medium">Middle Name</span>
                  <Input className="h-9" value={form.middleName} onChange={e => update('middleName', e.target.value)} aria-label="middleName" />
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground font-medium">Extension</span>
                  <Select value={form.extension} onValueChange={v => update('extension', v)}>
                    <SelectTrigger aria-label="extension" className="h-9">
                      <SelectValue placeholder="N/A" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">N/A</SelectItem>
                      <SelectItem value="Jr.">Jr.</SelectItem>
                      <SelectItem value="Sr.">Sr.</SelectItem>
                      <SelectItem value="III">III</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <span className="text-xs text-muted-foreground font-medium">Sex *</span>
                <div className="flex h-9 items-center gap-4">
                  {['Male', 'Female'].map(s => (
                    <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" name="gender" value={s} checked={form.gender === s} onChange={e => update('gender', e.target.value)} className="text-primary" required />
                      {s}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <span className="text-xs text-muted-foreground font-medium">Date of Birth *</span>
                <Input className="h-9" type="date" required value={form.dob} onChange={e => update('dob', e.target.value)} aria-label="dob" />
              </div>
              <div className="space-y-1.5">
                <span className="text-xs text-muted-foreground font-medium">Phone</span>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input className="h-9 pl-9" type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} aria-label="phone" placeholder="0917XXX-XXXX" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
            <MapPin size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Address</h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <span className="text-xs text-muted-foreground font-medium">Street / Purok</span>
                <Input className="h-9" value={form.street} onChange={e => update('street', e.target.value)} aria-label="street" />
              </div>
              <div className="space-y-1.5">
                <span className="text-xs text-muted-foreground font-medium">Barangay</span>
                <Input className="h-9" value={form.barangay} onChange={e => update('barangay', e.target.value)} aria-label="barangay" />
              </div>
            </div>
          </div>
        </div>

        {/* Referral Details */}
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
            <FileText size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Referral Details</h2>
          </div>
          <div className="p-4 space-y-1.5">
            <span className="text-xs text-muted-foreground font-medium">Reason for Referral *</span>
            <Textarea required value={form.reason} onChange={e => update('reason', e.target.value)} placeholder="Describe why this resident is being referred to MSWDO..." />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={submitting}>
            <Send size={14} className="mr-1" /> {submitting ? 'Submitting...' : 'Submit Referral'}
          </Button>
        </div>
      </form>
    </PageShell>
  );
}
