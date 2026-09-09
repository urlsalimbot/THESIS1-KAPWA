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