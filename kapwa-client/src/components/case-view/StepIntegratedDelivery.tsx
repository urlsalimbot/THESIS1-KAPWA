import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Send, Plus, Lock } from 'lucide-react';
import { CreateReferralForm } from '@/components/referrals/CreateReferralForm';
import { ReferralCard } from '@/components/referrals/ReferralCard';
import { Agency, InterAgencyReferral } from '@/components/referrals/referral-utils';
import { EmptyState } from '@/components/EmptyState';
import { StepInterventions } from './StepInterventions';
import { useTranslation } from 'react-i18next';

interface StepIntegratedDeliveryProps {
  caseId: string;
  caseData: any;
  userRole?: string;
  readOnly?: boolean;
}

export function StepIntegratedDelivery({ caseId, caseData, userRole, readOnly }: StepIntegratedDeliveryProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { mutate } = useSWRConfig();
  const [createOpen, setCreateOpen] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const { data: referrals, isLoading, mutate: revalidate } = useSWR<InterAgencyReferral[]>(
    queryKeys.interAgencyReferrals.byCase(caseId),
  );
  const { data: agencies } = useSWR<Agency[]>(queryKeys.agencies.list());

  const ben = caseData?.beneficiary as Record<string, unknown> | undefined;
  const initialBeneficiary = ben?.id
    ? { beneficiaryId: ben.id as string, label: `${ben.firstName || ''} ${ben.surname || ''}`.trim() }
    : undefined;

  async function transition(id: string, action: string, body?: Record<string, string>) {
    setTransitioning(true);
    try {
      await api.patch(`/inter-agency-referrals/${id}/${action}`, body);
      await revalidate();
      await mutate(queryKeys.cases.detail(caseId));
    } catch (err: any) {
      alert(err?.message || t('caseView.integrated.failedUpdateReferral', 'Failed to update referral'));
    } finally {
      setTransitioning(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Inter-Agency Referrals */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{t('caseView.integrated.interAgencyReferrals', 'Inter-Agency Referrals')}</h3>
            {readOnly && <Lock size={14} className="text-muted-foreground" />}
          </div>
          {!readOnly && (
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus size={14} className="mr-1" /> {t('caseView.integrated.createReferral', 'Create Referral')}
            </Button>
          )}
        </div>
        <Separator />
        <div className="px-4 py-3 space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-3">{t('caseView.integrated.loadingReferrals', 'Loading referrals...')}</p>
          ) : !referrals || referrals.length === 0 ? (
            <EmptyState variant="no-data" />
          ) : (
            referrals.map(r => (
              <ReferralCard
                key={r.id}
                referral={r}
                myAgencyId={user?.agencyId}
                onTransition={transition}
                disabled={transitioning}
              />
            ))
          )}
        </div>
      </div>

      {/* Interventions Record */}
      <StepInterventions caseId={caseId} caseData={caseData} userRole={userRole} readOnly={readOnly} />

      {/* Status transitions */}
      {caseData?.status === 'in_review' && userRole === 'admin' && (
        <div className="rounded-lg border bg-primary/5 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-primary">{t('caseView.integrated.readyForApproval', 'Ready for approval')}</p>
              <p className="text-xs text-muted-foreground">{t('caseView.integrated.readyForApprovalHint', 'Case is in review. Approve to activate services.')}</p>
            </div>
            <ApproveButton caseId={caseId} mutate={mutate} />
          </div>
        </div>
      )}
      {caseData?.status === 'active' && userRole === 'admin' && (
        <div className="rounded-lg border bg-primary/5 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-primary">{t('caseView.integrated.servicesDelivered', 'Services delivered')}</p>
              <p className="text-xs text-muted-foreground">{t('caseView.integrated.servicesDeliveredHint', 'Mark case as transitioning to begin graduation process.')}</p>
            </div>
            <DisburseButton caseId={caseId} mutate={mutate} />
          </div>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send size={16} className="text-primary" /> {t('caseView.integrated.createIarTitle', 'Create Inter-Agency Referral')}
            </DialogTitle>
            <DialogDescription>
              {t('caseView.integrated.createIarDesc', "Refer this case's beneficiary to a partner agency for coordinated services.")}
            </DialogDescription>
          </DialogHeader>
          <CreateReferralForm
            agencies={agencies || []}
            caseId={caseId}
            initialBeneficiary={initialBeneficiary}
            onCreated={() => {
              setCreateOpen(false);
              revalidate();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApproveButton({ caseId, mutate }: { caseId: string; mutate: any }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  async function handleApprove() {
    setLoading(true);
    try {
      await api.patch(`/cases/${caseId}/approve`, { status: 'active', signature: '' });
      await mutate(queryKeys.cases.detail(caseId));
    } catch (e) {
      console.error('Failed to approve:', e);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Button onClick={handleApprove} disabled={loading} size="sm">
      {loading ? t('caseView.approving', 'Approving...') : t('caseView.integrated.approveCase', '✓ Approve Case')}
    </Button>
  );
}

function DisburseButton({ caseId, mutate }: { caseId: string; mutate: any }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  async function handleDisburse() {
    setLoading(true);
    try {
      await api.patch(`/cases/${caseId}/disburse`, { status: 'transitioning' });
      await mutate(queryKeys.cases.detail(caseId));
    } catch (e) {
      console.error('Failed to disburse:', e);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Button onClick={handleDisburse} disabled={loading} size="sm">
      {loading ? t('caseView.processing', 'Processing...') : t('caseView.integrated.markForGraduation', '→ Mark for Graduation')}
    </Button>
  );
}
