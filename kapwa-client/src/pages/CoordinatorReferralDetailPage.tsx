import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { referralStatusLabel } from '@/i18n/display';
import { api } from '../lib/api';
import { PageShell } from '@/components/PageShell';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { AlertCircle } from 'lucide-react';
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

  // The PageShell header already carries the back control (backTo below);
  // there is deliberately no second back button in the body.
  const backTo = { label: t('coordinator.myReferrals', 'My Referrals'), onClick: () => navigate('/coordinator/referrals') };

  if (loading) {
    return (
      <PageShell title={t('coordinator.referralDetails', 'Referral Details')} description="" backTo={backTo}>
        <div className="mx-auto w-full max-w-2xl">
          <Card>
            <div className="p-5 space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          </Card>
        </div>
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
      <div className="mx-auto w-full max-w-2xl">
        <Card>
          <CardContent className="p-5 sm:p-6 space-y-5">
            {/* Referral summary: resident, the coordinator→MSWDO chain, status */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('coordinator.referralLabel', 'Municipal Referral')}
                </p>
                <h2 className="text-xl font-semibold font-heading leading-tight text-foreground">
                  {residentName(referral.surname, referral.firstName)}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t('referral.referredBy', 'Referred By')}: {referral.coordinator?.fullName || '—'} → {t('coordinator.toMswdo', 'MSWDO Norzagaray')}
                </p>
              </div>
              <Badge variant={variantMap[referral.status] || 'secondary'} className="shrink-0">
                {referralStatusLabel(t, referral.status)}
              </Badge>
            </div>

            <Separator />

            {/* Key details */}
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('coordinator.barangay', 'Barangay')}</dt>
                <dd className="mt-1 font-medium text-foreground">{referral.barangay}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('coordinator.address', 'Address')}</dt>
                <dd className="mt-1 font-medium text-foreground">{address}</dd>
              </div>
              {referral.phone && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('coordinator.phone', 'Contact Number')}</dt>
                  <dd className="mt-1 font-medium text-foreground">{referral.phone}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('coordinator.date', 'Date')}</dt>
                <dd className="mt-1 font-medium text-foreground">{formatDate(referral.createdAt)}</dd>
              </div>
              {referral.case?.controlNo && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('coordinator.caseNo', 'Case No.')}</dt>
                  <dd className="mt-1 font-mono font-medium text-foreground">{referral.case.controlNo}</dd>
                </div>
              )}
            </dl>

            {referral.reason && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('coordinator.reason', 'Reason')}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground">{referral.reason}</p>
                </div>
              </>
            )}

            {referral.declineReason && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-destructive">{t('coordinator.declineReason', 'Decline Reason')}</p>
                <p className="mt-1 text-sm leading-relaxed text-foreground">{referral.declineReason}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}