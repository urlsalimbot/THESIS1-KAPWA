/**
 * The single home of a case status's badge classes — the `.badge-*` classes in
 * index.css, whose background/foreground are theme-aware `--badge-*` tokens.
 *
 * Before this map existed the same status was painted by three local
 * `STATUS_BADGES` variant maps (Cases, Tracker, Dashboard) plus raw palette
 * classes in chips — adding a status meant editing every copy, and a change in
 * one screen could disagree with every other.
 */
const CASE_STATUS_CLASS: Record<string, string> = {
  enrolled: 'badge-pending',
  assessed: 'badge-review',
  in_review: 'badge-review',
  active: 'badge-approved',
  transitioning: 'badge-disbursed',
  closed: 'badge-closed',
  aftercare: 'badge-closed',
};

export function caseStatusClass(status?: string | null): string {
  return CASE_STATUS_CLASS[status ?? ''] ?? 'badge-category';
}