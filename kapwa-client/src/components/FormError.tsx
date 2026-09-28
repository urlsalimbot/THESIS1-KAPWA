import { AlertTriangle } from 'lucide-react';

/**
 * Inline error line for a form.
 *
 * The pages that show one previously used bare `catch {}` blocks, so a failed
 * request looked identical to a request that had nothing to report. `role="alert"`
 * is what makes it announce itself rather than only appearing.
 */
export function FormError({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
