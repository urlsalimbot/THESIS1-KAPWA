import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table';
import { Plus, Eye } from 'lucide-react';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';

interface Referral {
  id: string;
  surname: string;
  firstName: string;
  middleName?: string;
  barangay: string;
  reason: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  declineReason?: string;
  case?: { controlNo?: string } | null;
}

const statusBadge = (status: string) => {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    accepted: 'bg-green-100 text-green-800',
    declined: 'bg-red-100 text-red-800',
  };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors[status] || 'bg-gray-100'}`}>{status}</span>;
};

export function CoordinatorReferralListPage() {
  const navigate = useNavigate();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Referral | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });

  useEffect(() => {
    loadReferrals();
  }, []);

  async function loadReferrals() {
    try {
      const data = await api.get<Referral[]>('/referrals/mine');
      setReferrals(data);
    } catch {
      // handled
    }
    setLoading(false);
  }

  const columns: ColumnDef<Referral>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) => `${row.original.surname}, ${row.original.firstName}`,
    },
    { accessorKey: 'barangay', header: 'Barangay' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => statusBadge(row.original.status),
    },
    {
      accessorKey: 'reason',
      header: 'Reason',
      cell: ({ row }) => (
        <span className="text-xs line-clamp-2 max-w-xs">{row.original.reason}</span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Date',
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={() => setSelected(row.original)}>
          <Eye size={14} />
        </Button>
      ),
    },
  ];

  if (loading) return <div className="p-8 text-center text-gray-500">Loading referrals...</div>;

  return (
    <PageShell title="My Referrals" description="View the status of your referrals to MSWDO.">
      <div className="mb-4">
        <Button onClick={() => navigate('/coordinator/referrals/new')}>
          <Plus size={14} className="mr-1" /> New Referral
        </Button>
      </div>

      {referrals.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No referrals yet.</div>
      ) : (
        <DataTable columns={columns} data={referrals} rowCount={referrals.length} pagination={pagination} onPaginationChange={setPagination} sorting={[]} />
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-4">Referral Details</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Name</dt><dd className="font-medium">{selected.surname}, {selected.firstName}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Barangay</dt><dd>{selected.barangay}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Status</dt><dd>{statusBadge(selected.status)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Date</dt><dd>{new Date(selected.createdAt).toLocaleDateString()}</dd></div>
              <div className="pt-2"><dt className="text-muted-foreground mb-1">Reason</dt><dd className="text-sm">{selected.reason}</dd></div>
              {selected.declineReason && (
                <div className="pt-2"><dt className="text-red-600 text-xs mb-1">Decline Reason</dt><dd className="text-sm">{selected.declineReason}</dd></div>
              )}
              {selected.case?.controlNo && (
                <div className="flex justify-between pt-2"><dt className="text-muted-foreground">Case No.</dt><dd className="font-medium">{selected.case.controlNo}</dd></div>
              )}
            </dl>
            <div className="mt-4 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setSelected(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
