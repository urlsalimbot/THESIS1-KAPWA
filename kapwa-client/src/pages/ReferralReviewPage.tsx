import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { referralStatusLabel } from '@/i18n/display';
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
  const { t } = useTranslation();
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
      toast.success(t('referral.accepted', 'Referral accepted'));
    } catch {
      toast.error(t('referral.acceptFailed', 'Failed to accept referral'));
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
      toast.success(t('referral.declined', 'Referral declined'));
    } catch {
      toast.error(t('referral.declineFailed', 'Failed to decline referral'));
    }
    setActionId(null);
  }

  const columns: ColumnDef<Referral>[] = [
    {
      id: 'name',
      header: t('referral.name', 'Name'),
      cell: ({ row }) => `${row.original.surname}, ${row.original.firstName}`,
    },
    { accessorKey: 'barangay', header: t('referral.barangay', 'Barangay') },
    {
      id: 'coordinator',
      header: t('referral.referredBy', 'Referred By'),
      cell: ({ row }) => row.original.coordinator?.fullName || '—',
    },
    {
      accessorKey: 'reason',
      header: t('referral.reason', 'Reason'),
      cell: ({ row }) => <span className="text-xs line-clamp-2 max-w-xs">{row.original.reason}</span>,
    },
    {
      accessorKey: 'createdAt',
      header: t('referral.date', 'Date'),
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
    },
    {
      id: 'status',
      header: t('referral.status', 'Status'),
      cell: ({ row }) => (
        <Badge variant={variantMap[row.original.status]}>{referralStatusLabel(t, row.original.status)}</Badge>
      ),
    },
    {
      id: 'actions',
      header: t('referral.actions', 'Actions'),
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
            {t('referral.accept', 'Accept')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600"
            onClick={() => setDeclineModal(row.original)}
            disabled={actionId === row.original.id}
          >
            <X size={14} className="mr-1" /> {t('referral.decline', 'Decline')}
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <PageShell title={t('referral.reviewTitle', 'Referral Review')} description={t('referral.reviewDescription', 'Review and process barangay referrals.')}>
        <Card>
          <div className="border-b bg-muted/30 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-foreground">{t('referral.pendingReferrals', 'Pending Referrals')}</h2>
          </div>
          <div className="p-4 space-y-3">
            {[1, 2, 3].map(i => (
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
      </PageShell>
    );
  }

  return (
    <PageShell title={t('referral.reviewTitle', 'Referral Review')} description={t('referral.reviewDescription', 'Review and process barangay referrals.')}>
      {referrals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Inbox size={40} className="mb-3 opacity-30" />
          <p className="text-sm">{t('referral.noPending', 'No pending referrals.')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Inbox size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">{t('referral.pendingReferrals', 'Pending Referrals')}</h2>
          </div>
          <DataTable columns={columns} data={referrals} rowCount={referrals.length} pagination={pagination} onPaginationChange={setPagination} sorting={[]} />
        </div>
      )}

      <Dialog open={!!declineModal} onOpenChange={(open) => { if (!open) { setDeclineModal(null); setDeclineReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('referral.declineReferral', 'Decline Referral')}</DialogTitle>
            <DialogDescription>
              {declineModal?.surname}, {declineModal?.firstName} — {declineModal?.barangay}
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={declineReason}
            onChange={e => setDeclineReason(e.target.value)}
            placeholder={t('referral.declineReasonPlaceholder', 'Reason for declining...')}
            rows={3}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setDeclineModal(null); setDeclineReason(''); }}>
              {t('referral.cancel', 'Cancel')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleDecline(declineModal!.id)}
              disabled={!declineReason.trim() || actionId === declineModal?.id}
            >
              {actionId === declineModal?.id ? t('referral.declining', 'Declining...') : t('referral.confirmDecline', 'Confirm Decline')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
