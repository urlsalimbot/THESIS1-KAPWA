/**
 * Every column that stores a barangay name.
 *
 * `common/constants.ts` owns the 13 names; this owns where to look for them.
 * It lives in `src/` rather than beside the script that uses it so that
 * `barangay-columns.spec.ts` can pin it against the entities' metadata — the
 * check script is only as useful as this list, and a normalization that moves a
 * column would otherwise leave the script quietly reporting "skipped" while
 * claiming there is no drift.
 *
 * Only names that *are* a barangay are listed. A foreign key (`barangay_id`)
 * or a scoped join is a different thing and does not belong here.
 */
export interface BarangayColumn {
  table: string;
  column: string;
}

export const BARANGAY_COLUMNS: BarangayColumn[] = [
  // Where a user's own scope lives. Replaced `users.assigned_barangay` and
  // `users.permitted_barangays`, which migration DropUserLegacyColumns backs up
  // here and then drops. This is the column `req.user.assignedBarangay` reads,
  // and therefore the one a logged service's `source_barangay` is copied from.
  { table: 'user_barangay_assignments', column: 'barangay' },
  // The household's home barangay, which gates household-scoped queries.
  { table: 'households', column: 'barangay' },
  // A person's address, decomposed out of `persons.address`.
  { table: 'person_addresses', column: 'barangay' },
  { table: 'referrals', column: 'barangay' },
  // The audit copy on every card service, written from the user's scope.
  { table: 'access_card_services', column: 'source_barangay' },
  // The source list's barangay, kept verbatim on each deduplication row so the
  // review grid shows the claimed address (the import itself, not KAPWA).
  { table: 'client_import_rows', column: 'barangay' },
];
