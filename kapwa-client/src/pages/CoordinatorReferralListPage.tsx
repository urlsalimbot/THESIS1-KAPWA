import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { referralStatusLabel } from '@/i18n/display';
import { api } from '../lib/api';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/data-table';
import { Plus, Eye, Send } from 'lucide-react';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';
import { formatDate, residentName } from '../lib/format';

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

const variantMap: Record<string, 'secondary' | 'default' | 'destructive'> = {
  pending: 'secondary',
  accepted: 'default',
  declined: 'destructive',
};

export function CoordinatorReferralListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
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
      header: t('coordinator.name', 'Name'),
      cell: ({ row }) => residentName(row.original.surname, row.original.firstName),
    },
    { accessorKey: 'barangay', header: t('coordinator.barangay', 'Barangay') },
    {
      accessorKey: 'status',
      header: t('coordinator.status', 'Status'),
      cell: ({ row }) => (
        <Badge variant={variantMap[row.original.status] || 'secondary'}>{referralStatusLabel(t, row.original.status)}</Badge>
      ),
    },
    {
      accessorKey: 'reason',
      header: t('coordinator.reason', 'Reason'),
      cell: ({ row }) => (
        <span className="text-xs line-clamp-2 max-w-xs">{row.original.reason}</span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: t('coordinator.date', 'Date'),
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/coordinator/referrals/${row.original.id}`)}
          aria-label={t('coordinator.view', 'View')}
        >
          <Eye size={14} />
        </Button>
      ),
    },
  ];

  if (loading) {
    return (
      <PageShell title={t('coordinator.myReferrals', 'My Referrals')} description={t('coordinator.listDescription', 'View the status of your referrals to MSWDO.')}>
        <div className="mb-4">
          <Button onClick={() => navigate('/coordinator/referrals/new')}>
            <Plus size={14} className="mr-1" /> {t('coordinator.newReferral', 'New Referral')}
          </Button>
        </div>
        <Card>
          <div className="border-b bg-muted/30 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-foreground">{t('coordinator.myReferrals', 'My Referrals')}</h2>
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
      </PageShell>
    );
  }

  return (
    <PageShell title={t('coordinator.myReferrals', 'My Referrals')} description={t('coordinator.listDescription', 'View the status of your referrals to MSWDO.')}>
      <div className="mb-4">
        <Button onClick={() => navigate('/coordinator/referrals/new')}>
          <Plus size={14} className="mr-1" /> {t('coordinator.newReferral', 'New Referral')}
        </Button>
      </div>

      {referrals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Send size={40} className="mb-3 opacity-30" />
          <p className="text-sm">{t('coordinator.noReferrals', 'No referrals yet.')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Send size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">{t('coordinator.myReferrals', 'My Referrals')}</h2>
          </div>
          <DataTable columns={columns} data={referrals} rowCount={referrals.length} pagination={pagination} onPaginationChange={setPagination} sorting={[]} />
        </div>
      )}
    </PageShell>
  );
}
