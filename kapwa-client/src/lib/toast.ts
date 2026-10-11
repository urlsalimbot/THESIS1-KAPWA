import { toast } from 'sonner';
import i18n from '../i18n';

/**
 * The one shape a completed write reports itself in: the same word first, the
 * detail of *what* was written second.
 *
 * A worker catching a toast out of the corner of their eye reads the outcome in
 * the same place every time, and the part that differs — the specific row or
 * step — is the only part they have to actually read. `common.saved` follows the
 * app's existing `common.*` convention: the title is the same word in both
 * languages, and the per-action detail beside it is the translated half.
 *
 * `detail` is translated by the caller: it is per-action copy and belongs next to
 * the action, not in here.
 */
export function toastSaved(detail: string): void {
  toast.success(i18n.t('common.saved', 'Saved'), { description: detail });
}
