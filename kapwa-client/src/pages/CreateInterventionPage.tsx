import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSWRConfig } from 'swr';
import { api, uploadSignature, uploadReceipt, dataURItoBlob } from '../lib/api';
import SignaturePad from '../components/forms/SignaturePad';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export function CreateInterventionPage() {
  const navigate = useNavigate();
  const { mutate: globalMutate } = useSWRConfig();
  const [form, setForm] = useState({ caseId: '', type: '', amount: '', agency: '', fundSource: 'Regular' });
  const [sigDataUrl, setSigDataUrl] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field: string, value: string) { setForm({ ...form, [field]: value }); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      let workerSignatureUrl = '';
      let receiptUrl = '';

      if (sigDataUrl) {
        const blob = dataURItoBlob(sigDataUrl);
        workerSignatureUrl = await uploadSignature(blob, `sig-${Date.now()}.png`);
      }

      if (receiptFile) {
        receiptUrl = await uploadReceipt(receiptFile, receiptFile.name);
      }

      await api.post('/interventions', {
        caseId: form.caseId,
        interventionType: form.type,
        amount: parseFloat(form.amount) || 0,
        fundSource: form.fundSource,
        agency: form.agency || 'MSWDO',
        workerSignatureUrl: workerSignatureUrl || undefined,
        clientReceiptUrl: receiptUrl || undefined,
      } as Record<string, unknown>);

      toast.success('Intervention logged successfully');
      globalMutate('/interventions');
      navigate('/interventions');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create intervention');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell
      title="New Intervention"
      description="Post-disbursement intervention logging (case must be disbursed)"
      backTo={{ label: 'Interventions', onClick: () => navigate('/interventions') }}
    >
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Log Intervention</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Case ID (must be disbursed)</label>
                <Input required placeholder="Paste Case ID" value={form.caseId} onChange={e => update('caseId', e.target.value)} aria-label="Case ID" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  required value={form.type} onChange={e => update('type', e.target.value)} aria-label="Intervention Type"
                >
                  <option value="">Select...</option>
                  <option value="FA">Financial Assistance</option>
                  <option value="C">Counseling</option>
                  <option value="CSR">CSR</option>
                  <option value="R">Referral</option>
                  <option value="H">Healthcare</option>
                  <option value="HV">Home Visit</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Amount (₱)</label>
                <Input type="number" min="0" step="0.01" value={form.amount} onChange={e => update('amount', e.target.value)} aria-label="Amount" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Fund Source</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={form.fundSource} onChange={e => update('fundSource', e.target.value)} aria-label="Fund Source"
                >
                  <option value="Regular">Regular</option>
                  <option value="PDAF">PDAF</option>
                  <option value="Legislative">Legislative</option>
                  <option value="Donation">Donation</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Agency</label>
              <Input value={form.agency} placeholder="MSWDO" onChange={e => update('agency', e.target.value)} aria-label="Agency" />
            </div>
            <div className="space-y-2">
              <SignaturePad
                onSave={(dataUrl: string) => setSigDataUrl(dataUrl)}
                label="Worker Signature"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Client Receipt (optional photo)</label>
              <Input
                type="file"
                accept="image/*"
                onChange={e => setReceiptFile(e.target.files?.[0] || null)}
                aria-label="Client Receipt"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting} aria-label="Log Intervention">
                {submitting ? 'Saving...' : 'Log Intervention'}
              </Button>
              <Button variant="outline" onClick={() => navigate('/interventions')}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
