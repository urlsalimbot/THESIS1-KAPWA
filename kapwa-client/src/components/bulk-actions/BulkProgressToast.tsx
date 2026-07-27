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
      toast.error(`${actionLabel} failed`, { description: `${id} could not be processed.`, id: `err-${id}` });
    }
  }

  if (failed.length === 0) {
    toast.success(`${actionLabel} complete`, { description: `All ${total} case${total === 1 ? '' : 's'} processed.`, id: toastId });
  } else if (completed > 0) {
    toast.warning(`Partial success`, { description: `${completed}/${total} succeeded, ${failed.length} failed.`, id: toastId });
  } else {
    toast.error(`${actionLabel} failed`, { description: `All ${total} case${total === 1 ? '' : 's'} failed.`, id: toastId });
  }
}
