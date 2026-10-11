/** Case-status display labels — the server-side copy of the status vocabulary
 * the client owns in `i18n/display.ts`. Notifications and exports must not
 * name a status differently from the page that shows it. */
export const CASE_STATUS_LABELS: Record<string, string> = {
  enrolled: 'Enrolled',
  assessed: 'Assessed',
  in_review: 'In Review',
  active: 'Active',
  transitioning: 'Transitioning',
  closed: 'Closed',
  aftercare: 'Aftercare',
};

export function caseStatusLabel(status: string): string {
  return CASE_STATUS_LABELS[status] ?? status;
}