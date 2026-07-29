import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { api } from '../lib/api';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table';
import { Plus, Send, Check, X, Loader2 } from 'lucide-react';
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
  coordinator?: { fullName?: string };
}

const statusBadge = (status: string) => {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    accepted: 'bg-green-100 text-green-800',
    declined: 'bg-red-100 text-red-800',
  };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors[status] || 'bg-gray-100'}`}>{status}</span>;
};

export function ReferralsPage() {
  const { user } = useAuth();
  const role = user?.role || '';
  const isCoordinator = role === 'coordinator';
  const isWorker = role === 'admin' || role === 'social_worker';

  return (
    <PageShell title="Referrals" description="View and manage barangay referrals.">
      {isCoordinator && <CoordinatorReferralView />}
      {isWorker && <WorkerReferralView />}
    </PageShell>
  );
}

function CoordinatorReferralView() {
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
    } catch { /* handled */ }
    setLoading(false);
  }

  const columns: ColumnDef<Referral>[] = [
    { id: 'name', header: 'Name', cell: ({ row }) => `${row.original.surname}, ${row.original.firstName}` },
    { accessorKey: 'barangay', header: 'Barangay' },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => statusBadge(row.original.status) },
    { accessorKey: 'reason', header: 'Reason', cell: ({ row }) => <span className="text-xs line-clamp-2 max-w-xs">{row.original.reason}</span> },
    { accessorKey: 'createdAt', header: 'Date', cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString() },
    {
      id: 'actions', header: '',
      cell: ({ row }) => <Button variant="ghost" size="sm" onClick={() => setSelected(row.original)}>View</Button>,
    },
  ];

  if (loading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4">
      <Button onClick={() => navigate('/coordinator/referrals/new')}>
        <Plus size={14} className="mr-1" /> New Referral
      </Button>

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
              {selected.declineReason && <div className="pt-2"><dt className="text-red-600 text-xs mb-1">Decline Reason</dt><dd className="text-sm">{selected.declineReason}</dd></div>}
              {selected.case?.controlNo && <div className="flex justify-between pt-2"><dt className="text-muted-foreground">Case No.</dt><dd className="font-medium">{selected.case.controlNo}</dd></div>}
            </dl>
            <div className="mt-4 flex justify-end"><Button variant="outline" size="sm" onClick={() => setSelected(null)}>Close</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkerReferralView() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [declineModal, setDeclineModal] = useState<Referral | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });

  useEffect(() => {
    loadReferrals();
  }, []);

  async function loadReferrals() {
    try {
      const data = await api.get<Referral[]>('/referrals?status=pending');
      setReferrals(data);
    } catch { /* handled */ }
    setLoading(false);
  }

  async function handleAccept(id: string) {
    setActionId(id);
    try { await api.patch(`/referrals/${id}/accept`, {}); setReferrals(prev => prev.filter(r => r.id !== id)); } catch { /* handled */ }
    setActionId(null);
  }

  async function handleDecline(id: string) {
    if (!declineReason.trim()) return;
    setActionId(id);
    try {
      await api.patch(`/referrals/${id}/decline`, { reason: declineReason });
      setReferrals(prev => prev.filter(r => r.id !== id));
      setDeclineModal(null);
      setDeclineReason('');
    } catch { /* handled */ }
    setActionId(null);
  }

  const columns: ColumnDef<Referral>[] = [
    { id: 'name', header: 'Name', cell: ({ row }) => `${row.original.surname}, ${row.original.firstName}` },
    { accessorKey: 'barangay', header: 'Barangay' },
    { id: 'coordinator', header: 'Referred By', cell: ({ row }) => row.original.coordinator?.fullName || '—' },
    { accessorKey: 'reason', header: 'Reason', cell: ({ row }) => <span className="text-xs line-clamp-2 max-w-xs">{row.original.reason}</span> },
    { accessorKey: 'createdAt', header: 'Date', cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString() },
    {
      id: 'actions', header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="text-green-600" onClick={() => handleAccept(row.original.id)} disabled={actionId === row.original.id}>
            {actionId === row.original.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Accept
          </Button>
          <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeclineModal(row.original)} disabled={actionId === row.original.id}>
            <X size={14} className="mr-1" /> Decline
          </Button>
        </div>
      ),
    },
  ];

  if (loading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4">
      {referrals.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No pending referrals.</div>
      ) : (
        <DataTable columns={columns} data={referrals} rowCount={referrals.length} pagination={pagination} onPaginationChange={setPagination} sorting={[]} />
      )}

      {declineModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => { setDeclineModal(null); setDeclineReason(''); }}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-2">Decline Referral</h3>
            <p className="text-sm text-muted-foreground mb-4">{declineModal.surname}, {declineModal.firstName} — {declineModal.barangay}</p>
            <textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)} placeholder="Reason for declining..." rows={3} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 mb-4" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setDeclineModal(null); setDeclineReason(''); }}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={() => handleDecline(declineModal.id)} disabled={!declineReason.trim() || actionId === declineModal.id}>
                {actionId === declineModal.id ? 'Declining...' : 'Confirm Decline'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
