import { toast } from 'sonner';
import i18n from '../../i18n';

export async function showBulkProgress(
  selectedIds: string[],
  actionFn: (id: string) => Promise<void>,
  actionLabel: string = i18n.t('bulkActions.processing', 'Processing')
): Promise<void> {
  const t = i18n.t.bind(i18n);
  const total = selectedIds.length;
  let completed = 0;
  const failed: string[] = [];

  const toastId = toast.loading(t('bulkActions.progress', '{{label}} {{done}}/{{total}}...', { label: actionLabel, done: 0, total }));

  for (const id of selectedIds) {
    try {
      await actionFn(id);
      completed++;
      toast.loading(t('bulkActions.progress', '{{label}} {{done}}/{{total}}...', { label: actionLabel, done: completed, total }), { id: toastId });
    } catch {
      failed.push(id);
      toast.error(t('bulkActions.failed', '{{label}} failed', { label: actionLabel }), { description: t('bulkActions.couldNotProcess', '{{id}} could not be processed.', { id }), id: `err-${id}` });
    }
  }

  if (failed.length === 0) {
    toast.success(t('bulkActions.complete', '{{label}} complete', { label: actionLabel }), { description: t('bulkActions.allProcessed', 'All {{count}} case(s) processed.', { count: total }), id: toastId });
  } else if (completed > 0) {
    toast.warning(t('bulkActions.partialSuccess', 'Partial success'), { description: t('bulkActions.partialDesc', '{{done}}/{{total}} succeeded, {{failed}} failed.', { done: completed, total, failed: failed.length }), id: toastId });
  } else {
    toast.error(t('bulkActions.failed', '{{label}} failed', { label: actionLabel }), { description: t('bulkActions.allFailed', 'All {{count}} case(s) failed.', { count: total }), id: toastId });
  }
}
