// The only case categories on which court hearings may be recorded. Mirrored
// in the client (StepCourtHearings visibility). Home visits know no gate.
export const LEGAL_CATEGORIES: ReadonlySet<string> = new Set([
  'Children in Conflict with the Law (CICL)',
  'Violence Against Women and Their Children (VAWC)',
  'Children in Need of Special Protection (CNSP)',
  'Adoption & Foster Care Case',
  'Indigency / Court-Ordered Social Case Study',
]);

/**
 * Whether an event belongs on the shared calendar: planned, home visits
 * unconditionally, hearings only when the office attends. The single
 * definition — `CaseEventsService` (create/update) and
 * `TeamScheduleSyncService` (reassignment) both read it, so a reassignment can
 * never resurrect a block for a done, cancelled or not-attended event.
 */
export function shouldSyncCaseEvent(event: {
  status?: string | null;
  eventType?: string | null;
  attended?: boolean | null;
}): boolean {
  return event.status === 'planned'
    && (event.eventType === 'home_visit' || event.attended === true);
}