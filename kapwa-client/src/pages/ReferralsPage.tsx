import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { api } from '../lib/api';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { DataTable } from '@/components/data-table';
import { Plus, Send, Check, X, Inbox, Loader2 } from 'lucide-react';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';
import { toast } from 'sonner';

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

const variantMap: Record<string, 'secondary' | 'default' | 'destructive'> = {
  pending: 'secondary',
  accepted: 'default',
  declined: 'destructive',
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
    {
      accessorKey: 'status', header: 'Status',
      cell: ({ row }) => <Badge variant={variantMap[row.original.status] || 'secondary'}>{row.original.status}</Badge>,
    },
    { accessorKey: 'reason', header: 'Reason', cell: ({ row }) => <span className="text-xs line-clamp-2 max-w-xs">{row.original.reason}</span> },
    { accessorKey: 'createdAt', header: 'Date', cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString() },
    {
      id: 'actions', header: '',
      cell: ({ row }) => <Button variant="ghost" size="sm" onClick={() => setSelected(row.original)}>View</Button>,
    },
  ];

  if (loading) {
    return (
      <>
        <Button onClick={() => navigate('/coordinator/referrals/new')}>
          <Plus size={14} className="mr-1" /> New Referral
        </Button>
        <Card>
          <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
            <Send size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">My Referrals</h2>
          </div>
          <div className="p-4 space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-1/6" />
                <Skeleton className="h-4 w-1/6" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-8 w-16 ml-auto" />
              </div>
            ))}
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <Button onClick={() => navigate('/coordinator/referrals/new')}>
        <Plus size={14} className="mr-1" /> New Referral
      </Button>

      {referrals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Send size={40} className="mb-3 opacity-30" />
          <p className="text-sm">No referrals yet.</p>
        </div>
      ) : (
        <Card>
          <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
            <Send size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">My Referrals</h2>
          </div>
          <div className="p-0">
            <DataTable columns={columns} data={referrals} rowCount={referrals.length} pagination={pagination} onPaginationChange={setPagination} sorting={[]} />
          </div>
        </Card>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Referral Details</DialogTitle>
            <DialogDescription>Referral information for {selected?.surname}, {selected?.firstName}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <span className="text-xs text-muted-foreground font-medium">Name</span>
              <p className="font-medium">{selected?.surname}, {selected?.firstName}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground font-medium">Barangay</span>
              <p className="font-medium">{selected?.barangay}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground font-medium">Status</span>
              <p className="font-medium">
                {selected && <Badge variant={variantMap[selected.status] || 'secondary'}>{selected.status}</Badge>}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground font-medium">Date</span>
              <p className="font-medium">{selected && new Date(selected.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="col-span-2">
              <span className="text-xs text-muted-foreground font-medium">Reason</span>
              <p className="font-medium">{selected?.reason}</p>
            </div>
            {selected?.declineReason && (
              <div className="col-span-2">
                <span className="text-xs text-destructive">Decline Reason</span>
                <p className="font-medium">{selected.declineReason}</p>
              </div>
            )}
            {selected?.case?.controlNo && (
              <div>
                <span className="text-xs text-muted-foreground font-medium">Case No.</span>
                <p className="font-medium">{selected.case.controlNo}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
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
    try {
      await api.patch(`/referrals/${id}/accept`, {});
      setReferrals(prev => prev.filter(r => r.id !== id));
      toast.success('Referral accepted');
    } catch {
      toast.error('Failed to accept referral');
    }
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
      toast.success('Referral declined');
    } catch {
      toast.error('Failed to decline referral');
    }
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

  if (loading) {
    return (
      <Card>
        <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
          <Inbox size={16} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Pending Referrals</h2>
        </div>
        <div className="p-4 space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-1/6" />
              <Skeleton className="h-4 w-1/6" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-8 w-24 ml-auto" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <>
      {referrals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Inbox size={40} className="mb-3 opacity-30" />
          <p className="text-sm">No pending referrals.</p>
        </div>
      ) : (
        <Card>
          <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
            <Inbox size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Pending Referrals</h2>
          </div>
          <div className="p-0">
            <DataTable columns={columns} data={referrals} rowCount={referrals.length} pagination={pagination} onPaginationChange={setPagination} sorting={[]} />
          </div>
        </Card>
      )}

      <Dialog open={!!declineModal} onOpenChange={(open) => { if (!open) { setDeclineModal(null); setDeclineReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Referral</DialogTitle>
            <DialogDescription>
              {declineModal?.surname}, {declineModal?.firstName} — {declineModal?.barangay}
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={declineReason}
            onChange={e => setDeclineReason(e.target.value)}
            placeholder="Reason for declining..."
            rows={3}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setDeclineModal(null); setDeclineReason(''); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleDecline(declineModal!.id)}
              disabled={!declineReason.trim() || actionId === declineModal?.id}
            >
              {actionId === declineModal?.id ? 'Declining...' : 'Confirm Decline'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
