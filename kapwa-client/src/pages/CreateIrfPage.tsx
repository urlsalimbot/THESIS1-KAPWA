import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSWRConfig } from 'swr';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Shield, User, Phone } from 'lucide-react';

export function CreateIrfPage() {
  const navigate = useNavigate();
  const { mutate: globalMutate } = useSWRConfig();
  const [form, setForm] = useState({ caseCategory: '', narration: '', reporterName: '', reporterContact: '' });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/irf', {
        caseCategory: form.caseCategory,
        narration: form.narration,
        itemAReportingPerson: { name: form.reporterName, contact: form.reporterContact },
      });
      toast.success('IRF created successfully');
      globalMutate(queryKeys.irf.list());
      navigate('/irf');
    } catch (err) {
      console.error(err);
      toast.error('Failed to create IRF');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell
      title="New Incident Report"
      description="VAWC / RA 9262 case — MSWDO Norzagaray"
      backTo={{ label: 'IRF List', onClick: () => navigate('/irf') }}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Case Category + Reporter */}
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <div className="border-b bg-muted/30 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-foreground">Case Details</h2>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-[1fr_1fr_1.5fr] gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Case Category *</label>
                <select
                  value={form.caseCategory}
                  onChange={e => setForm({ ...form, caseCategory: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label="Case Category"
                  required
                >
                  <option value="">Select...</option>
                  <option value="Abuse">Abuse</option>
                  <option value="Neglect">Neglect</option>
                  <option value="Exploitation">Exploitation</option>
                  <option value="Criminal">Criminal</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <User size={12} /> Reporter Name *
                </label>
                <Input required value={form.reporterName} onChange={e => setForm({ ...form, reporterName: e.target.value })} className="h-9" aria-label="Reporter Name" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <Phone size={12} /> Reporter Contact
                </label>
                <Input value={form.reporterContact} onChange={e => setForm({ ...form, reporterContact: e.target.value })} className="h-9" aria-label="Reporter Contact" />
              </div>
            </div>
          </div>
        </div>

        {/* Narration — takes the full visual weight */}
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
            <Shield size={14} className="text-accent" />
            <h2 className="text-sm font-semibold text-foreground">Narration</h2>
            <span className="text-[11px] text-muted-foreground ml-auto">AES-256 encrypted at rest</span>
          </div>
          <div className="p-4">
            <textarea
              value={form.narration}
              onChange={e => setForm({ ...form, narration: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y min-h-[200px]"
              placeholder="Describe the incident in detail. Include date, time, location, persons involved, and the sequence of events."
              aria-label="Narration"
              required
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <Button type="submit" disabled={submitting} aria-label="Create IRF" className="gap-2">
            {submitting ? 'Creating...' : 'Create IRF'}
          </Button>
          <Button variant="outline" onClick={() => navigate('/irf')}>Cancel</Button>
        </div>
      </form>
    </PageShell>
  );
}
