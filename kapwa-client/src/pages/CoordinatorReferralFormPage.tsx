import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send } from 'lucide-react';

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
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/coordinator/referrals')}>
          <ArrowLeft size={14} className="mr-1" /> Back to Referrals
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <div className="space-y-4">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Personal Information</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Surname *</label>
              <Input required value={form.surname} onChange={e => update('surname', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">First Name *</label>
              <Input required value={form.firstName} onChange={e => update('firstName', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Middle Name</label>
              <Input value={form.middleName} onChange={e => update('middleName', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Extension</label>
              <Input value={form.extension} onChange={e => update('extension', e.target.value)} placeholder="Jr., III" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Gender *</label>
              <select
                required
                value={form.gender}
                onChange={e => update('gender', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select...</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Date of Birth *</label>
              <Input type="date" required value={form.dob} onChange={e => update('dob', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Phone</label>
              <Input value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="09XX-XXX-XXXX" />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Address</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Street / Purok</label>
              <Input value={form.street} onChange={e => update('street', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Barangay</label>
              <Input value={form.barangay} onChange={e => update('barangay', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Referral Details</p>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Reason for Referral *</label>
            <textarea
              required
              value={form.reason}
              onChange={e => update('reason', e.target.value)}
              rows={4}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describe why this resident is being referred to MSWDO..."
            />
          </div>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <Button type="submit" disabled={submitting}>
          <Send size={14} className="mr-1" /> {submitting ? 'Submitting...' : 'Submit Referral'}
        </Button>
      </form>
    </PageShell>
  );
}
