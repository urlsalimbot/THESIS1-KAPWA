import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { referralStatusLabel } from '@/i18n/display';
import { useAuth } from '@/lib/auth-context';
import { api } from '../lib/api';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { DataTable } from '@/components/data-table';
import { IncomingInterAgencyReferrals } from '@/components/referrals/IncomingInterAgencyReferrals';
import { referralIntakeState, referralListName } from '@/components/referrals/referral-utils';
import { Plus, Send, Check, X, Inbox, Loader2, ArrowUpRight, ClipboardList } from 'lucide-react';
import type { ColumnDef, PaginationState, SortingState } from '@tanstack/react-table';
import { toast } from 'sonner';

interface Referral {
  id: string;
  personId?: string | null;
  caseId?: string | null;
  // Name schema, assembled from the linked person server-side.
  surname: string;
  firstName: string;
  middleName?: string;
  extension?: string;
  gender?: string;
  dob?: string;
  phone?: string;
  address?: Record<string, string>;
  currentAddress?: Record<string, string>;
  addressLine?: string;
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

function SectionHeader({ icon: Icon, title, count, actions }: {
  icon: typeof Send; title: string; count?: number; actions?: React.ReactNode;
}) {
  return (
    <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
      <Icon size={16} className="text-muted-foreground" />
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {count !== undefined && (
        <Badge variant="secondary" className="text-[10px]">{count}</Badge>
      )}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}

function EmptyReferrals({ icon: Icon, text }: { icon: typeof Send; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Icon size={40} className="mb-3 opacity-30" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="p-4 space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/6" />
          <Skeleton className="h-4 w-1/6" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-8 w-16 ml-auto" />
        </div>
      ))}
    </div>
  );
}

export function ReferralsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const role = user?.role || '';
  const isCoordinator = role === 'coordinator';
  const isWorker = role === 'admin' || role === 'social_worker';

  return (
    <PageShell title={t('referral.title', 'Referrals')} description={t('referral.description', 'View and manage barangay referrals.')}>
      {isCoordinator && <CoordinatorReferralView />}
      {isWorker && <WorkerReferralView />}
    </PageShell>
  );
}

function CoordinatorReferralView() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Referral | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState<SortingState>([]);

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
    {
      accessorKey: 'createdAt', header: t('referral.date', 'Date'),
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
    },
    {
      id: 'name', header: t('referral.name', 'Name'),
      cell: ({ row }) => <span className="font-medium">{referralListName(row.original)}</span>,
    },
    { accessorKey: 'barangay', header: t('referral.barangay', 'Barangay') },
    {
      accessorKey: 'status', header: t('referral.status', 'Status'),
      cell: ({ row }) => <Badge variant={variantMap[row.original.status] || 'secondary'}>{referralStatusLabel(t, row.original.status)}</Badge>,
    },
    {
      accessorKey: 'reason', header: t('referral.reason', 'Reason'),
      cell: ({ row }) => <span className="text-xs text-muted-foreground line-clamp-2 max-w-xs">{row.original.reason}</span>,
    },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={() => setSelected(row.original)} aria-label={t('referral.viewAria', 'View referral for {{name}}', { name: referralListName(row.original) })}>
          {t('referral.view', 'View')} <ArrowUpRight size={14} className="ml-1" />
        </Button>
      ),
    },
  ];

  return (
    <Card className="shadow-sm border-border/60">
      <SectionHeader
        icon={Send}
        title={t('referral.myReferrals', 'My Referrals')}
        count={referrals.length}
        actions={
          <Button size="sm" onClick={() => navigate('/coordinator/referrals/new')}>
            <Plus size={14} className="mr-1" /> {t('referral.newReferral', 'New Referral')}
          </Button>
        }
      />
      {loading ? (
        <ListSkeleton />
      ) : referrals.length === 0 ? (
        <EmptyReferrals icon={Send} text={t('referral.noReferrals', 'No referrals yet.')} />
      ) : (
        <div className="p-4">
          <DataTable columns={columns} data={referrals} rowCount={referrals.length} pagination={pagination} onPaginationChange={setPagination} sorting={sorting} onSortingChange={setSorting} />
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('referral.details', 'Referral Details')}</DialogTitle>
            <DialogDescription>{t('referral.detailsFor', 'Referral information for {{name}}', { name: referralListName(selected) })}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <span className="text-xs text-muted-foreground font-medium">{t('referral.name', 'Name')}</span>
              <p className="font-medium">{referralListName(selected)}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground font-medium">{t('referral.barangay', 'Barangay')}</span>
              <p className="font-medium">{selected?.barangay}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground font-medium">{t('referral.status', 'Status')}</span>
              <p className="font-medium">
                {selected && <Badge variant={variantMap[selected.status] || 'secondary'}>{referralStatusLabel(t, selected.status)}</Badge>}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground font-medium">{t('referral.date', 'Date')}</span>
              <p className="font-medium">{selected && new Date(selected.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="col-span-2">
              <span className="text-xs text-muted-foreground font-medium">{t('referral.reason', 'Reason')}</span>
              <p className="font-medium">{selected?.reason}</p>
            </div>
            {selected?.declineReason && (
              <div className="col-span-2">
                <span className="text-xs text-destructive">{t('referral.declineReason', 'Decline Reason')}</span>
                <p className="font-medium">{selected.declineReason}</p>
              </div>
            )}
            {selected?.case?.controlNo && (
              <div>
                <span className="text-xs text-muted-foreground font-medium">{t('referral.caseNo', 'Case No.')}</span>
                <p className="font-medium">{selected.case.controlNo}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function WorkerReferralView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [awaiting, setAwaiting] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [declineModal, setDeclineModal] = useState<Referral | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState<SortingState>([]);

  useEffect(() => {
    loadReferrals();
    loadAwaiting();
  }, []);

  async function loadReferrals() {
    try {
      const data = await api.get<Referral[]>('/referrals?status=pending');
      setReferrals(data);
    } catch { /* handled */ }
    setLoading(false);
  }

  // Accepted referrals that never got a case: the intake handed off from accept
  // was abandoned, so the worker needs a way back into it.
  async function loadAwaiting() {
    try {
      const data = await api.get<Referral[]>('/referrals?intakePending=true');
      setAwaiting(data);
    } catch { /* handled */ }
  }

  function openIntakeFor(r: Referral) {
    navigate('/intake', { state: referralIntakeState('barangay', r) });
  }

  async function handleAccept(id: string) {
    setActionId(id);
    try {
      const accepted = await api.patch<Referral>(`/referrals/${id}/accept`, {});
      setReferrals(prev => prev.filter(r => r.id !== id));
      toast.success(t('referral.accepted', 'Referral accepted'));

      // Hand off to the intake that creates the case. A referral with no linked
      // person has nothing to prefill, so it stays on the list.
      if (accepted?.personId) openIntakeFor(accepted);
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
      accessorKey: 'createdAt', header: t('referral.date', 'Date'),
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
    },
    {
      id: 'name', header: t('referral.name', 'Name'),
      cell: ({ row }) => <span className="font-medium">{referralListName(row.original)}</span>,
    },
    { accessorKey: 'barangay', header: t('referral.barangay', 'Barangay') },
    {
      id: 'coordinator', header: t('referral.referredBy', 'Referred By'),
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.coordinator?.fullName || '—'}</span>,
    },
    {
      accessorKey: 'reason', header: t('referral.reason', 'Reason'),
      cell: ({ row }) => <span className="text-xs text-muted-foreground line-clamp-2 max-w-xs">{row.original.reason}</span>,
    },
    {
      id: 'actions', header: t('referral.actions', 'Actions'),
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button
            variant="outline" size="sm" className="text-emerald-700 border-emerald-300/60 hover:bg-emerald-50"
            onClick={() => handleAccept(row.original.id)} disabled={actionId === row.original.id}
            aria-label={t('referral.acceptAria', 'Accept referral for {{name}}', { name: referralListName(row.original) })}
          >
            {actionId === row.original.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {t('referral.accept', 'Accept')}
          </Button>
          <Button
            variant="outline" size="sm" className="text-destructive border-destructive/30/60 hover:bg-destructive/10"
            onClick={() => setDeclineModal(row.original)} disabled={actionId === row.original.id}
            aria-label={t('referral.declineAria', 'Decline referral for {{name}}', { name: referralListName(row.original) })}
          >
            <X size={14} className="mr-1" /> {t('referral.decline', 'Decline')}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Card className="shadow-sm border-border/60">
        <SectionHeader
          icon={Inbox}
          title={t('referral.pendingReferrals', 'Pending Referrals')}
          count={referrals.length}
        />
        {loading ? (
          <ListSkeleton />
        ) : referrals.length === 0 ? (
          <EmptyReferrals icon={Inbox} text={t('referral.noPending', 'No pending referrals.')} />
        ) : (
          <div className="p-4">
            <DataTable columns={columns} data={referrals} rowCount={referrals.length} pagination={pagination} onPaginationChange={setPagination} sorting={sorting} onSortingChange={setSorting} />
          </div>
        )}
      </Card>

      <Card className="shadow-sm border-border/60">
        <SectionHeader
          icon={ClipboardList}
          title={t('referral.awaitingIntake', 'Awaiting intake')}
          count={awaiting.length}
        />
        {awaiting.length === 0 ? (
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            {t('referral.awaitingIntakeDesc', 'Accepted referrals that still need an intake and a case.')}
          </CardContent>
        ) : (
          <div className="divide-y">
            {awaiting.map(r => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium">{referralListName(r)}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.barangay} — {r.reason}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="secondary">{t('referral.intakePending', 'Intake pending')}</Badge>
                  <Button
                    size="sm"
                    onClick={() => openIntakeFor(r)}
                    aria-label={t('referral.continueIntakeAria', 'Continue intake for {{name}}', { name: referralListName(r) })}
                  >
                    {t('referral.continueIntake', 'Continue intake')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <IncomingInterAgencyReferrals />

      <Dialog open={!!declineModal} onOpenChange={(open) => { if (!open) { setDeclineModal(null); setDeclineReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('referral.declineReferral', 'Decline Referral')}</DialogTitle>
            <DialogDescription>
              {referralListName(declineModal)} — {declineModal?.barangay}
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
    </div>
  );
}