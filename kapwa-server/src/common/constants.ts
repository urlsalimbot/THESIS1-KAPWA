// Single source of truth for server-wide constants (consolidated from the
// per-module constants.ts files: auth, notifications, dashboard, audit, chat,
// filing, users, sla, otp). Keep module-specific tuning values here.

// --- Generic list/pagination defaults ---
export const DEFAULT_LIST_LIMIT = 100;
export const DEFAULT_PAGE_SIZE = 50;
export const DEFAULT_NOTIF_LIMIT = 20;
export const DEFAULT_MESSAGE_LIMIT = 50;
export const DEFAULT_DOC_LIMIT = 100;
export const AUDIT_LOG_DEFAULT_LIMIT = 100;
export const HASH_CHAIN_BATCH_LIMIT = 1000;
export const RECENT_CASES_LIMIT = 10;

export function paginate<T extends import('typeorm').ObjectLiteral>(qb: import('typeorm').SelectQueryBuilder<T>, page = 1, limit = DEFAULT_LIST_LIMIT) {
  return qb.skip((page - 1) * limit).take(limit);
}

// Export filenames follow `${CaseType} ${caseNumber}-${YYYY}-${MM}-${DD}.pdf`
// (e.g. "GIS KAPWA-2026-00006-2026-09-09.pdf") — used by every case-document
// export endpoint (GIS, CSR, IRF). The date is the export date in server-local
// time (containers run TZ=Asia/Manila).
export function exportFileName(caseType: string, caseNumber: string, date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${caseType} ${caseNumber}-${y}-${m}-${d}.pdf`;
}

// --- Barangay vocabulary ---
//
// MSWDO Norzagaray operates 13 barangays — no more, no less. This list is the
// enforcement point for `users.assigned_barangay` and `users.permitted_barangays`.
//
// It matters beyond user management: the access-card write path copies the
// acting user's assigned barangay straight into
// `access_card_services.source_barangay` (AccessCardsController.logService,
// FourPsService.logToCard), and the coordinator's history query filters on that
// same column. A misspelled assignment therefore produces ledger rows that no
// list query can match, and the coordinator never sees their own work.
//
// Declared as an `as const` tuple rather than derived from BARANGAYS so
// `z.enum` accepts it directly and `Barangay` stays a real 13-member union
// instead of collapsing to `string`. `name` in BARANGAYS is typed as Barangay,
// so a typo in a seeded entry is a compile error.
export const BARANGAY_NAMES = [
  'Bangkal',
  'Baraka',
  'Bigte',
  'Bitungol',
  'Friendship Village Resources (FVR)',
  'Matictic',
  'Minuyan',
  'Partida',
  'Pinagtulayan',
  'Poblacion',
  'San Lorenzo',
  'San Mateo',
  'Tigbe',
] as const;

export type Barangay = (typeof BARANGAY_NAMES)[number];

// Slug/name pairs, used by the account seeder to mint per-barangay coordinator
// logins. One entry per name above, no more.
export const BARANGAYS: readonly { slug: string; name: Barangay }[] = [
  { slug: 'bangkal', name: 'Bangkal' },
  { slug: 'baraka', name: 'Baraka' },
  { slug: 'bigte', name: 'Bigte' },
  { slug: 'bitungol', name: 'Bitungol' },
  { slug: 'fvr', name: 'Friendship Village Resources (FVR)' },
  { slug: 'matictic', name: 'Matictic' },
  { slug: 'minuyan', name: 'Minuyan' },
  { slug: 'partida', name: 'Partida' },
  { slug: 'pinagtulayan', name: 'Pinagtulayan' },
  { slug: 'poblacion', name: 'Poblacion' },
  { slug: 'sanlorenzo', name: 'San Lorenzo' },
  { slug: 'sanmateo', name: 'San Mateo' },
  { slug: 'tigbe', name: 'Tigbe' },
];

// Static geographic parts of the official letterhead stamped on every generated
// PDF. The office name itself is NOT here — it is resolved from the agencies
// table (MSWDO row) via OrgService so exports always print system data.
export const ORG_LOCATION = {
  country: 'Republic of the Philippines',
  region: 'Region III',
  province: 'Bulacan',
  municipality: 'Norzagaray',
} as const;

// Municipal mayor stamped as the approver on generated Petty Cash Vouchers.
// This is the one pre-printed name on the form — every other value is sourced
// from the database. Update here when the sitting mayor changes.
export const MUNICIPAL_MAYOR = {
  name: 'HON. MARIA ELENA L. GERMAR',
  title: 'MUNICIPAL MAYOR',
} as const;

// Fallback signatories for generated reports when no matching user exists
// (fresh/empty database). Live users take precedence — see SummaryReportService.
export const REPORT_FALLBACK_SIGNATORIES = {
  preparedBy: 'ARLYNDA F. GAMUTIA',
  preparedByRole: 'MSWD - STAFF',
  notedBy: 'ANNALYN JOY C. SAN PEDRO, RSW',
  notedByRole: 'MSWD-HEAD',
} as const;

// --- Auth / security ---
export const BCRYPT_SALT_ROUNDS = 12;
export const MIN_PASSWORD_LENGTH = 8;
export const JWT_ACCESS_EXPIRY = '1h';
export const JWT_REFRESH_EXPIRY = '7d';

// --- OTP ---
export const OTP_LENGTH = 6;
export const OTP_EXPIRY_MINUTES = 5;
export const OTP_RATE_LIMIT_SECONDS = 60;
export const OTP_MIN = 100000;
export const OTP_RANGE = 900000;
export const MS_PER_SECOND = 1000;
export const SECONDS_PER_MINUTE = 60;

// --- Chat ---
export const RATE_LIMIT_WINDOW_MS = 60000;
export const RATE_LIMIT_MAX_MESSAGES = 30;

// --- Filing ---
export const MAX_FILE_SIZE = 10_000_000;

// --- SLA escalation / warnings (days) ---
export const PENDING_ESCALATION_DAYS = 3;
export const PENDING_WARNING_DAYS = 2;
export const REVIEW_ESCALATION_DAYS = 3;      // was 5
export const REVIEW_WARNING_DAYS = 2;          // was 3
export const APPROVED_ESCALATION_DAYS = 3;     // was 7
export const APPROVED_WARNING_DAYS = 2;        // was 5
export const SLA_OVERDUE_DAYS = 3;
export const SATURDAY = 6;
export const SUNDAY = 0;