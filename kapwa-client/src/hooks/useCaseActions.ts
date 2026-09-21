import { useState } from 'react';
import { mutate } from 'swr';
import useSWRMutation from 'swr/mutation';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { toast } from 'sonner';
import { isOnline } from '../lib/sync';
import { queueFsmTransition } from '../lib/offline-queue';
import { humanizeError } from '../lib/errors';
import i18n from '../i18n';

export function useCaseActions() {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { trigger: requestReview } = useSWRMutation(
    queryKeys.cases.all,
    (_key, { arg }: { arg: { id: string } }) => api.patch(`/cases/${arg.id}/request-review`),
  );
  const { trigger: submitReview } = useSWRMutation(
    queryKeys.cases.all,
    (_key, { arg }: { arg: { id: string } }) => api.patch(`/cases/${arg.id}/status`, { status: 'in_review' }),
  );
  const { trigger: disburseCase } = useSWRMutation(
    queryKeys.cases.all,
    (_key, { arg }: { arg: { id: string } }) => api.patch(`/cases/${arg.id}/disburse`, { status: 'transitioning' }),
  );
  const { trigger: closeCase } = useSWRMutation(
    queryKeys.cases.all,
    (_key, { arg }: { arg: { id: string } }) => api.patch(`/cases/${arg.id}/close`),
  );
  const { trigger: overrideCaseStatus } = useSWRMutation(
    queryKeys.cases.all,
    (_key, { arg }: { arg: { id: string; status: string; reason: string } }) =>
      api.patch(`/cases/${arg.id}/override-status`, { status: arg.status, reason: arg.reason }),
  );

  async function handleAction(action: string, caseId: string) {
    setActionLoading(caseId);
    try {
      switch (action) {
        case 'request-review':
          if (isOnline()) {
            await requestReview({ id: caseId });
          } else {
            // request-review moves enrolled -> assessed (the review request is
            // the assessed transition); queue the matching target state so the
            // sync applies a valid FSM step.
            await queueFsmTransition(caseId, 'assessed');
            toast.success(i18n.t('caseView.actions.queued', 'Saved offline'), {
              description: i18n.t('caseView.actions.queuedDesc', 'The review request will be sent when you are back online.'),
            });
          }
          break;
        case 'submit-review':
          if (!isOnline()) {
            toast.warning(i18n.t('common.onlineRequired', 'Connection required'), {
              description: i18n.t('common.onlineRequiredDesc', 'This action needs an internet connection.'),
            });
            setActionLoading(null);
            return;
          }
          await submitReview({ id: caseId });
          break;
        case 'disburse':
          if (!isOnline()) {
            toast.warning(i18n.t('common.onlineRequired', 'Connection required'), {
              description: i18n.t('common.onlineRequiredDesc', 'This action needs an internet connection.'),
            });
            setActionLoading(null);
            return;
          }
          await disburseCase({ id: caseId });
          break;
        case 'close':
          if (!isOnline()) {
            toast.warning(i18n.t('common.onlineRequired', 'Connection required'), {
              description: i18n.t('common.onlineRequiredDesc', 'This action needs an internet connection.'),
            });
            setActionLoading(null);
            return;
          }
          await closeCase({ id: caseId });
          break;
        case 'override':
          if (!isOnline()) {
            toast.warning(i18n.t('common.onlineRequired', 'Connection required'), {
              description: i18n.t('common.onlineRequiredDesc', 'This action needs an internet connection.'),
            });
            setActionLoading(null);
            return;
          }
          await overrideCaseStatus({ id: caseId, status: 'active', reason: 'admin override' });
          break;
      }
      await mutate(queryKeys.cases.all, undefined, { revalidate: true });
    } catch (err) {
      console.error(`Action ${action} failed:`, err);
      toast.error(i18n.t('caseView.actions.failed', 'Action could not be completed'), {
        description: humanizeError(err),
      });
    }
    setActionLoading(null);
  }

  return { actionLoading, handleAction };
}
