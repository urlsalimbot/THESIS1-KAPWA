import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Send, AlertTriangle } from 'lucide-react';

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
      navigate('/coordinator/referrals');
    } catch (err: any) {
      setError(err?.message || 'Failed to submit referral');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell title="New Referral" description="Refer a barangay resident to MSWDO for assessment.">
      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800 flex items-center gap-2">
          <AlertTriangle size={14} className="shrink-0" /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
        {/* Personal Information */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Personal Information</h2>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-2">Name of the Resident</p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Surname *</label>
                  <Input required value={form.surname} onChange={e => update('surname', e.target.value)} aria-label="surname" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">First Name *</label>
                  <Input required value={form.firstName} onChange={e => update('firstName', e.target.value)} aria-label="firstName" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Middle Name</label>
                  <Input value={form.middleName} onChange={e => update('middleName', e.target.value)} aria-label="middleName" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Extension</label>
                  <select
                    value={form.extension}
                    onChange={e => update('extension', e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label="extension"
                  >
                    <option value="">N/A</option>
                    <option value="Jr.">Jr.</option>
                    <option value="Sr.">Sr.</option>
                    <option value="III">III</option>
                  </select>
                </div>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Sex *</label>
                <div className="flex h-10 items-center gap-4">
                  {['Male', 'Female'].map(s => (
                    <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" name="gender" value={s} checked={form.gender === s} onChange={e => update('gender', e.target.value)} className="text-primary" required />
                      {s}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Date of Birth *</label>
                <Input type="date" required value={form.dob} onChange={e => update('dob', e.target.value)} aria-label="dob" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone</label>
                <Input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} aria-label="phone" placeholder="0917XXX-XXXX" />
              </div>
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Address</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Street / Purok</label>
              <Input value={form.street} onChange={e => update('street', e.target.value)} aria-label="street" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Barangay</label>
              <Input value={form.barangay} onChange={e => update('barangay', e.target.value)} aria-label="barangay" />
            </div>
          </div>
        </div>

        {/* Referral Details */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Referral Details</h2>
          <div className="space-y-2">
            <label className="text-sm font-medium">Reason for Referral *</label>
            <textarea
              required
              value={form.reason}
              onChange={e => update('reason', e.target.value)}
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[100px]"
              placeholder="Describe why this resident is being referred to MSWDO..."
            />
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
