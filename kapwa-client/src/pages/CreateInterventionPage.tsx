import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSWRConfig } from 'swr';
import { api, uploadSignature, uploadReceipt, dataURItoBlob } from '../lib/api';
import SignaturePad from '../components/forms/SignaturePad';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { FileText, DollarSign, Building2, PiggyBank, Pen, Camera } from 'lucide-react';

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
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Main fields */}
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <div className="border-b bg-muted/30 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-foreground">Intervention Details</h2>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-[1.5fr_1fr] gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <FileText size={12} /> Case ID (must be disbursed) *
                </label>
                <Input required placeholder="Paste Case ID" value={form.caseId} onChange={e => update('caseId', e.target.value)} className="h-9" aria-label="Case ID" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Type *</label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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

            <div className="grid grid-cols-[1fr_1fr_1fr] gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <DollarSign size={12} /> Amount (₱)
                </label>
                <Input type="number" min="0" step="0.01" value={form.amount} onChange={e => update('amount', e.target.value)} className="h-9" aria-label="Amount" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <PiggyBank size={12} /> Fund Source
                </label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={form.fundSource} onChange={e => update('fundSource', e.target.value)} aria-label="Fund Source"
                >
                  <option value="Regular">Regular</option>
                  <option value="PDAF">PDAF</option>
                  <option value="Legislative">Legislative</option>
                  <option value="Donation">Donation</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <Building2 size={12} /> Agency
                </label>
                <Input value={form.agency} placeholder="MSWDO" onChange={e => update('agency', e.target.value)} className="h-9" aria-label="Agency" />
              </div>
            </div>
          </div>
        </div>

        {/* Signature + Receipt — side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
            <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
              <Pen size={14} className="text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Worker Signature</h2>
            </div>
            <div className="p-4">
              <SignaturePad
                onSave={(dataUrl: string) => setSigDataUrl(dataUrl)}
                label="Sign below"
              />
            </div>
          </div>

          <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
            <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
              <Camera size={14} className="text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Client Receipt</h2>
            </div>
            <div className="p-4 space-y-2">
              <p className="text-xs text-muted-foreground">Upload a photo of the signed receipt (optional)</p>
              <Input
                type="file"
                accept="image/*"
                onChange={e => setReceiptFile(e.target.files?.[0] || null)}
                className="h-9 text-sm file:h-full file:border-0 file:bg-muted file:px-3 file:text-xs file:font-medium file:text-foreground file:mr-3"
                aria-label="Client Receipt"
              />
              {receiptFile && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Camera size={12} /> {receiptFile.name}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <Button type="submit" disabled={submitting} aria-label="Log Intervention">
            {submitting ? 'Saving...' : 'Log Intervention'}
          </Button>
          <Button variant="outline" onClick={() => navigate('/interventions')}>Cancel</Button>
        </div>
      </form>
    </PageShell>
  );
}
