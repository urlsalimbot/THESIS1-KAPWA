import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { referralStatusLabel } from '@/i18n/display';
import { api } from '../lib/api';
import { PageShell } from '@/components/PageShell';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { formatDate, residentName } from '../lib/format';

interface ReferralDetail {
  id: string;
  surname: string;
  firstName: string;
  middleName?: string;
  barangay: string;
  reason: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  declineReason?: string;
  addressLine?: string;
  currentAddress?: Record<string, string>;
  address?: Record<string, string>;
  phone?: string;
  case?: { controlNo?: string } | null;
  coordinator?: { fullName?: string };
}

const variantMap: Record<string, 'secondary' | 'default' | 'destructive'> = {
  pending: 'secondary',
  accepted: 'default',
  declined: 'destructive',
};

export function CoordinatorReferralDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [referral, setReferral] = useState<ReferralDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(false);
      try {
        const data = await api.get<ReferralDetail>(`/referrals/${id}`);
        if (cancelled) return;
        setReferral(data);
      } catch {
        if (cancelled) return;
        setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const backTo = { label: t('coordinator.myReferrals', 'My Referrals'), onClick: () => navigate('/coordinator/referrals') };

  if (loading) {
    return (
      <PageShell title={t('coordinator.referralDetails', 'Referral Details')} description="" backTo={backTo}>
        <Card>
          <div className="p-4 space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </Card>
      </PageShell>
    );
  }

  if (error || !referral) {
    return (
      <PageShell title={t('coordinator.referralDetails', 'Referral Details')} description="" backTo={backTo}>
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <AlertCircle size={40} className="mb-3 opacity-30" />
          <p className="text-sm">{t('referrals.notFoundBody', 'This referral may have been removed or you do not have access to it.')}</p>
        </div>
      </PageShell>
    );
  }

  const address = referral.addressLine
    || [referral.currentAddress?.street, referral.currentAddress?.barangay].filter(Boolean).join(', ')
    || '—';

  return (
    <PageShell
      title={t('coordinator.referralDetails', 'Referral Details')}
      description={t('coordinator.detailsFor', 'Referral information for {{name}}', { name: residentName(referral.surname, referral.firstName) })}
      backTo={backTo}
    >
      <div className="max-w-3xl space-y-4">
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">{residentName(referral.surname, referral.firstName)}</h2>
                <p className="text-xs text-muted-foreground">
                  {t('referral.referredBy', 'Referred By')}: {referral.coordinator?.fullName || '—'} → {t('coordinator.toMswdo', 'MSWDO Norzagaray')}
                </p>
              </div>
              <Badge variant={variantMap[referral.status] || 'secondary'}>{referralStatusLabel(t, referral.status)}</Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground font-medium">{t('coordinator.barangay', 'Barangay')}</span>
                <p className="font-medium">{referral.barangay}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-medium">{t('coordinator.address', 'Address')}</span>
                <p className="font-medium">{address}</p>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground font-medium">{t('coordinator.reason', 'Reason')}</span>
                <p className="font-medium">{referral.reason}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-medium">{t('coordinator.date', 'Date')}</span>
                <p className="font-medium">{formatDate(referral.createdAt)}</p>
              </div>
              {referral.case?.controlNo && (
                <div>
                  <span className="text-xs text-muted-foreground font-medium">{t('coordinator.caseNo', 'Case No.')}</span>
                  <p className="font-medium">{referral.case.controlNo}</p>
                </div>
              )}
              {referral.declineReason && (
                <div className="col-span-2">
                  <span className="text-xs text-destructive">{t('coordinator.declineReason', 'Decline Reason')}</span>
                  <p className="font-medium">{referral.declineReason}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <button
          type="button"
          onClick={() => navigate('/coordinator/referrals')}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} /> {t('coordinator.myReferrals', 'My Referrals')}
        </button>
      </div>
    </PageShell>
  );
}