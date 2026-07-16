import React, { useState } from 'react';
import { useSWRConfig } from 'swr';
import useSWR from 'swr';
import { api, uploadSignature, uploadReceipt, dataURItoBlob } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import SignaturePad from '../components/forms/SignaturePad';
import { PageShell } from '@/components/PageShell';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ColumnDef } from '@tanstack/react-table';

interface Intervention {
  id: string;
  caseId: string;
  beneficiary: string;
  type: string;
  description: string;
  provider: string;
  date: string;
  verified: boolean;
  signatureStatus?: string;
  clientReceiptUrl?: string;
  fundSource?: string;
  amount?: number;
}

export function InterventionsPage() {
  const { mutate: globalMutate } = useSWRConfig();
  const { data, isLoading: loading } = useSWR<Array<Record<string, unknown>>>('/interventions');
  const interventions: Intervention[] = (data || []).map((i) => {
    const beneficiary = (i.case as Record<string, unknown>)?.beneficiary as Record<string, unknown> || {};
    return {
      id: i.id as string,
      caseId: i.caseId as string || '',
      beneficiary: beneficiary.firstName && beneficiary.surname ? `${beneficiary.firstName} ${beneficiary.surname}` : '',
      type: i.interventionType as string || '',
      description: `₱${i.amount || 0}`,
      fundSource: i.fundSource as string || 'Regular',
      amount: (i.amount as number) || 0,
      provider: i.agency as string || 'MSWDO',
      date: i.serviceDate ? new Date(i.serviceDate as string).toLocaleDateString() : '',
      verified: !!i.workerSignatureUrl,
      signatureStatus: i.signatureStatus as string | undefined,
      clientReceiptUrl: i.clientReceiptUrl as string | undefined,
    };
  });
  const lastSync = data ? Date.now() : null;

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({
    caseId: '', type: '', description: '', provider: '',
    amount: '', agency: '', fundSource: 'Regular',
  });
  const [sigDataUrl, setSigDataUrl] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function update(field: string, value: string) { setForm({ ...form, [field]: value }); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
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

      setShowForm(false);
      setForm({ caseId: '', type: '', description: '', provider: '', amount: '', agency: '', fundSource: 'Regular' });
      setSigDataUrl(null);
      setReceiptFile(null);
      globalMutate('/interventions');
    } catch (err: any) {
      setError(err.message || 'Failed to create intervention');
    }
    setSubmitting(false);
  }

  const columns: ColumnDef<Intervention>[] = [
    { accessorKey: 'beneficiary', header: 'Beneficiary' },
    { accessorKey: 'type', header: 'Type', cell: ({ row }) => <Badge variant="secondary">{row.original.type}</Badge> },
    { accessorKey: 'description', header: 'Amount' },
    { accessorKey: 'fundSource', header: 'Fund Source', cell: ({ row }) => <Badge variant="secondary">{row.original.fundSource}</Badge> },
    { accessorKey: 'provider', header: 'Agency' },
    { accessorKey: 'date', header: 'Date' },
    {
      id: 'signature',
      header: 'Signature',
      cell: ({ row }) => {
        if (row.original.signatureStatus === 'signatures_pending') {
          return <Badge variant="outline">Signatures Pending</Badge>;
        }
        return row.original.verified
          ? <Badge variant="default">✓ Signed</Badge>
          : <Badge variant="outline">Pending</Badge>;
      },
    },
    {
      id: 'receipt',
      header: 'Receipt',
      cell: ({ row }) => row.original.clientReceiptUrl
        ? <a href={row.original.clientReceiptUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline text-sm">View Receipt</a>
        : <span className="text-muted-foreground text-sm">None</span>,
    },
  ];

  if (loading) {
    return (
      <PageShell title="Interventions" description="Post-disbursement intervention logging (case must be disbursed)">
        <TableSkeleton rows={5} />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Interventions"
      description="Post-disbursement intervention logging (case must be disbursed)"
      cachedAt={lastSync ?? undefined}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <Button variant="default" onClick={() => setShowForm(!showForm)} aria-label="+ New Intervention">+ New Intervention</Button>
      </div>

      {/* New Intervention Form */}
      {showForm && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Log Intervention</CardTitle>
          </CardHeader>
          <CardContent>
            {error && <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}
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
                <Button variant="outline" onClick={() => { setShowForm(false); setError(''); setSigDataUrl(null); setReceiptFile(null); }} aria-label="Cancel">Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Data table / Empty state */}
      {!loading && interventions.length === 0 ? (
        <EmptyState variant="no-data" />
      ) : (
        <DataTable
          columns={columns}
          data={interventions}
          rowCount={interventions.length}
          pagination={{ pageIndex: 0, pageSize: 10 }}
          sorting={[]}
        />
      )}
    </PageShell>
  );
}
