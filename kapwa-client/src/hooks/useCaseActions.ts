import { useState } from 'react';
import { mutate } from 'swr';
import useSWRMutation from 'swr/mutation';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { isOnline } from '../lib/sync';
import { queueFsmTransition } from '../lib/offline-queue';

export function useCaseActions() {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { trigger: requestReview } = useSWRMutation(
    queryKeys.cases.all,
    (_key, { arg }: { arg: { id: string } }) => api.put(`/cases/${arg.id}/request-review`),
  );
  const { trigger: disburseCase } = useSWRMutation(
    queryKeys.cases.all,
    (_key, { arg }: { arg: { id: string } }) => api.put(`/cases/${arg.id}/disburse`, { status: 'disbursed' }),
  );
  const { trigger: closeCase } = useSWRMutation(
    queryKeys.cases.all,
    (_key, { arg }: { arg: { id: string } }) => api.put(`/cases/${arg.id}/close`),
  );
  const { trigger: overrideCaseStatus } = useSWRMutation(
    queryKeys.cases.all,
    (_key, { arg }: { arg: { id: string; status: string; reason: string } }) =>
      api.put(`/cases/${arg.id}/override-status`, { status: arg.status, reason: arg.reason }),
  );

  async function handleAction(action: string, caseId: string) {
    setActionLoading(caseId);
    try {
      switch (action) {
        case 'request-review':
          if (isOnline()) {
            await requestReview({ id: caseId });
          } else {
            await queueFsmTransition(caseId, 'in_review');
            alert('Review request queued — will sync when online.');
          }
          break;
        case 'disburse':
          if (!isOnline()) {
            alert('This action requires an internet connection.');
            setActionLoading(null);
            return;
          }
          await disburseCase({ id: caseId });
          break;
        case 'close':
          if (!isOnline()) {
            alert('This action requires an internet connection.');
            setActionLoading(null);
            return;
          }
          await closeCase({ id: caseId });
          break;
        case 'override':
          if (!isOnline()) {
            alert('This action requires an internet connection.');
            setActionLoading(null);
            return;
          }
          await overrideCaseStatus({ id: caseId, status: 'approved', reason: 'admin override' });
          break;
      }
      await mutate(queryKeys.cases.all, undefined, { revalidate: true });
    } catch (err) {
      console.error(`Action ${action} failed:`, err);
      alert(`Action failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    setActionLoading(null);
  }

  return { actionLoading, handleAction };
}
