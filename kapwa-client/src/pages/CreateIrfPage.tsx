import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSWRConfig } from 'swr';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

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
      description="VAWC/RA 9262 case — MSWDO Norzagaray"
      backTo={{ label: 'IRF List', onClick: () => navigate('/irf') }}
    >
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Incident Report Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Case Category</label>
              <select
                value={form.caseCategory}
                onChange={e => setForm({ ...form, caseCategory: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
            <div className="space-y-2">
              <label className="text-sm font-medium">Reporter Name</label>
              <Input required value={form.reporterName} onChange={e => setForm({ ...form, reporterName: e.target.value })} aria-label="Reporter Name" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reporter Contact</label>
              <Input value={form.reporterContact} onChange={e => setForm({ ...form, reporterContact: e.target.value })} aria-label="Reporter Contact" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Narration (AES-256 encrypted)</label>
              <textarea
                value={form.narration}
                onChange={e => setForm({ ...form, narration: e.target.value })}
                className="flex h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Narration"
                required
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting} aria-label="Create IRF">
                {submitting ? 'Creating...' : 'Create IRF'}
              </Button>
              <Button variant="outline" onClick={() => navigate('/irf')}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
