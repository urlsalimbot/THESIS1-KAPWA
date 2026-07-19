import React, { useState } from 'react';
import useSWR from 'swr';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { useNavigate } from 'react-router-dom';
import { PageShell } from '@/components/PageShell';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';

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
  const navigate = useNavigate();
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
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
        <Button variant="default" onClick={() => navigate('/interventions/new')} aria-label="+ New Intervention">+ New Intervention</Button>
      </div>

      {/* Data table / Empty state */}
      {!loading && interventions.length === 0 ? (
        <EmptyState variant="no-data" />
      ) : (
        <DataTable
          columns={columns}
          data={interventions}
          rowCount={interventions.length}
          pagination={pagination}
          onPaginationChange={setPagination}
          sorting={[]}
        />
      )}
    </PageShell>
  );
}
