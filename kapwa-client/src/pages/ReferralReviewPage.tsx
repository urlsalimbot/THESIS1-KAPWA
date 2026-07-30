import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { DataTable } from '@/components/data-table';
import { Check, X, Loader2, Inbox } from 'lucide-react';
import { toast } from 'sonner';
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
  coordinator?: { fullName?: string };
}

const variantMap: Record<string, 'secondary' | 'default' | 'destructive'> = {
  pending: 'secondary',
  accepted: 'default',
  declined: 'destructive',
};

export function ReferralReviewPage() {
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
    } catch {
      /* handled */
    }
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
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) => `${row.original.surname}, ${row.original.firstName}`,
    },
    { accessorKey: 'barangay', header: 'Barangay' },
    {
      id: 'coordinator',
      header: 'Referred By',
      cell: ({ row }) => row.original.coordinator?.fullName || '—',
    },
    {
      accessorKey: 'reason',
      header: 'Reason',
      cell: ({ row }) => <span className="text-xs line-clamp-2 max-w-xs">{row.original.reason}</span>,
    },
    {
      accessorKey: 'createdAt',
      header: 'Date',
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={variantMap[row.original.status]}>{row.original.status}</Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-green-600"
            onClick={() => handleAccept(row.original.id)}
            disabled={actionId === row.original.id}
          >
            {actionId === row.original.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Accept
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600"
            onClick={() => setDeclineModal(row.original)}
            disabled={actionId === row.original.id}
          >
            <X size={14} className="mr-1" /> Decline
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <PageShell title="Referral Review" description="Review and process barangay referrals.">
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <div className="border-b bg-muted/30 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-foreground">Pending Referrals</h2>
          </div>
          <div className="p-4 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/4" />
                <div className="h-4 bg-muted rounded w-1/6" />
                <div className="h-4 bg-muted rounded w-1/6" />
                <div className="h-4 bg-muted rounded w-1/3" />
                <div className="h-8 bg-muted rounded w-24 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Referral Review" description="Review and process barangay referrals.">
      {referrals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Inbox size={40} className="mb-3 opacity-30" />
          <p className="text-sm">No pending referrals.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
            <Inbox size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Pending Referrals</h2>
          </div>
          <div className="p-0">
            <DataTable columns={columns} data={referrals} rowCount={referrals.length} pagination={pagination} onPaginationChange={setPagination} sorting={[]} />
          </div>
        </div>
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
    </PageShell>
  );
}
