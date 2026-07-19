import React, { useState } from 'react';
import { useSWRConfig } from 'swr';
import useSWR from 'swr';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { CardGridSkeleton } from '@/components/skeletons/CardGridSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';
import { CreditCard, Printer, Search, ClipboardList, Plus } from 'lucide-react';

interface ServiceLog { id: string; accessCardCode: string; serviceType: string; serviceDate: string; servedBy?: string; remarks: string; createdAt: string; }

export function AccessCardPage() {
  const navigate = useNavigate();
  const { mutate: globalMutate } = useSWRConfig();
  const { data: services = [], isLoading: loading } = useSWR<ServiceLog[]>(queryKeys.accessCards.list());
  const lastSync = services ? Date.now() : null;

  const [beneficiaryId, setBeneficiaryId] = useState('');
  const [assignedCode, setAssignedCode] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [cardSearchInput, setCardSearchInput] = useState('');
  const [cardData, setCardData] = useState<{ beneficiary: any; code: string; services: any[] } | null>(null);
  const [logForm, setLogForm] = useState({ accessCardCode: '', serviceType: '', serviceDate: '', remarks: '' });
  const [successBanner, setSuccessBanner] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [printBeneficiaryId, setPrintBeneficiaryId] = useState('');

  React.useEffect(() => {
    if (successBanner) {
      const t = setTimeout(() => setSuccessBanner(''), 3000);
      return () => clearTimeout(t);
    }
  }, [successBanner]);

  async function handleAssign() {
    if (!beneficiaryId.trim()) return;
    setAssigning(true);
    setAssignError('');
    setAssignedCode('');
    try {
      const result = await api.post<{ accessCardCode: string }>(`/access-cards/assign/${beneficiaryId.trim()}`);
      setAssignedCode(result.accessCardCode);
      setSuccessBanner(`Access Card assigned: ${result.accessCardCode}`);
    } catch (e: any) {
      setAssignError(e.message || 'Failed to assign card');
    }
    setAssigning(false);
  }

  async function handleSearchCard() {
    if (!cardSearchInput.trim()) return;
    try {
      const data = await api.get<{ beneficiary: any; code: string; services: any[] }>(
        `/access-cards/beneficiary/${cardSearchInput.trim()}/card`,
      );
      setCardData(data);
    } catch (e) {
      setCardData(null);
    }
  }

  async function logService(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post('/access-cards/log', logForm);
      setLogForm({ accessCardCode: '', serviceType: '', serviceDate: '', remarks: '' });
      globalMutate(queryKeys.accessCards.list());
    } catch (e) { console.error(e); }
  }

  const columns: ColumnDef<ServiceLog>[] = [
    { accessorKey: 'accessCardCode', header: 'Card Code', cell: ({ row }) => <span className="font-mono text-xs font-medium">{row.original.accessCardCode}</span> },
    { accessorKey: 'serviceType', header: 'Service Type', cell: ({ row }) => <Badge variant="secondary">{row.original.serviceType}</Badge> },
    { accessorKey: 'serviceDate', header: 'Service Date', cell: ({ row }) => <span>{new Date(row.original.serviceDate).toLocaleDateString()}</span> },
    { accessorKey: 'servedBy', header: 'Served By', cell: ({ row }) => <span className="text-muted-foreground">{row.original.servedBy || '-'}</span> },
    { accessorKey: 'remarks', header: 'Remarks', cell: ({ row }) => <span className="text-muted-foreground">{row.original.remarks || '-'}</span> },
    { accessorKey: 'createdAt', header: 'Logged At', cell: ({ row }) => <span className="text-muted-foreground">{new Date(row.original.createdAt).toLocaleDateString()}</span> },
  ];

  if (loading) {
    return (
      <PageShell title="Access Cards" description="Manage access card records">
        <CardGridSkeleton count={2} />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Access Cards"
      description="Manage access card records"
      cachedAt={lastSync ?? undefined}
    >
      {successBanner && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-medium text-emerald-700">
          {successBanner}
        </div>
      )}

      {/* Single card with sections instead of separate Card components */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        {/* Generate & Assign */}
        <div>
          <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
            <CreditCard size={14} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Generate & Assign Access Card</h2>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Beneficiary ID (UUID)"
                value={beneficiaryId}
                onChange={e => setBeneficiaryId(e.target.value)}
                aria-label="Beneficiary ID"
                className="font-mono h-9"
              />
              <Button
                onClick={handleAssign}
                disabled={assigning || !beneficiaryId.trim()}
                aria-label="Generate and Assign Card"
                className="shrink-0"
              >
                {assigning ? 'Assigning...' : <><Plus size={16} className="mr-1" /> Generate & Assign</>}
              </Button>
            </div>
            {assignedCode && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                Card Assigned: <span className="font-mono">{assignedCode}</span>
              </div>
            )}
            {assignError && (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{assignError}</div>
            )}
          </div>
        </div>

        {/* Quick Print — Card View */}
        <div>
          <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
            <Printer size={14} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Quick Print — Card View</h2>
          </div>
          <div className="p-4 flex items-center gap-2">
            <Input
              placeholder="Beneficiary ID (UUID)"
              value={printBeneficiaryId}
              onChange={e => setPrintBeneficiaryId(e.target.value)}
              aria-label="Print Card Beneficiary ID"
              className="font-mono h-9"
            />
            <Button
              onClick={() => navigate(`/beneficiary/${printBeneficiaryId}/card/print`)}
              disabled={!printBeneficiaryId.trim()}
              aria-label="Go to Print View"
              className="shrink-0"
            >
              <Printer size={16} className="mr-1" /> Print Card
            </Button>
          </div>
        </div>

        {/* Look Up Beneficiary Card */}
        <div>
          <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
            <Search size={14} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Look Up Beneficiary Card</h2>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Beneficiary ID (UUID)"
                value={cardSearchInput}
                onChange={e => setCardSearchInput(e.target.value)}
                aria-label="Search Beneficiary Card"
                className="font-mono h-9"
              />
              <Button
                onClick={handleSearchCard}
                variant="secondary"
                aria-label="Look up"
                className="shrink-0"
              >
                <Search size={16} className="mr-1" /> Look Up
              </Button>
            </div>
            {cardData && (
              <div className="rounded-md border border-border bg-muted/30 px-3 py-3 text-sm space-y-2">
                <p className="font-medium text-foreground">
                  Card: <span className="font-mono">{cardData.code}</span>
                </p>
                {cardData.beneficiary && (
                  <p className="text-xs text-muted-foreground">
                    {cardData.beneficiary.surname}, {cardData.beneficiary.first_name} — {cardData.beneficiary.barangay}
                  </p>
                )}
                <Button
                  onClick={() => navigate(`/beneficiary/${cardSearchInput}/card/print`)}
                  size="sm"
                  variant="outline"
                  aria-label="Print Card from search"
                >
                  <Printer size={14} className="mr-1" /> Print Card
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Log Service to Access Card */}
        <div>
          <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
            <ClipboardList size={14} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Log Service to Access Card</h2>
          </div>
          <div className="p-4">
            <form onSubmit={logService} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <Input placeholder="Access Card Code" aria-label="Access Card Code" value={logForm.accessCardCode} onChange={e => setLogForm({ ...logForm, accessCardCode: e.target.value })} required className="h-9" />
              <select
                value={logForm.serviceType}
                onChange={e => setLogForm({ ...logForm, serviceType: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                required
                aria-label="Service Type"
              >
                <option value="">Service Type</option>
                <option value="FA">Financial Assistance</option>
                <option value="C">Counseling</option>
                <option value="CSR">Case Study Report</option>
                <option value="R">Referral</option>
                <option value="H">Healthcare</option>
                <option value="HV">Home Visit</option>
              </select>
              <Input type="date" value={logForm.serviceDate} onChange={e => setLogForm({ ...logForm, serviceDate: e.target.value })} aria-label="Service Date" required className="h-9" />
              <Button type="submit" aria-label="Log Service">Log Service</Button>
            </form>
          </div>
        </div>
      </div>

      {/* Services Log Table */}
      {!loading && services.length === 0 ? (
        <EmptyState variant="no-data" />
      ) : (
        <div className="mt-4">
          <DataTable
            columns={columns}
            data={services}
            rowCount={services.length}
            pagination={pagination}
            onPaginationChange={setPagination}
            sorting={[]}
          />
        </div>
      )}
    </PageShell>
  );
}
