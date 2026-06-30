import { toast } from 'sonner';

export async function showBulkProgress(
  selectedIds: string[],
  actionFn: (id: string) => Promise<void>,
  actionLabel: string = 'Processing'
): Promise<void> {
  const total = selectedIds.length;
  let completed = 0;
  const failed: string[] = [];

  const toastId = toast.loading(`${actionLabel} 0/${total}...`);

  for (const id of selectedIds) {
    try {
      await actionFn(id);
      completed++;
      toast.loading(`${actionLabel} ${completed}/${total}...`, { id: toastId });
    } catch {
      failed.push(id);
      toast.error(`${id}: ${actionLabel} failed`);
    }
  }

  if (failed.length === 0) {
    toast.success(`${actionLabel} complete for ${total} case${total === 1 ? '' : 's'}.`, { id: toastId });
  } else if (completed > 0) {
    toast.warning(`${actionLabel}: ${completed}/${total} succeeded, ${failed.length} failed.`, { id: toastId });
  } else {
    toast.error(`${actionLabel} failed for all ${total} case${total === 1 ? '' : 's'}.`, { id: toastId });
  }
}
