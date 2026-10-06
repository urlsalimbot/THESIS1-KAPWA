import { ApiError } from './api-error';

// User-facing copy for failed requests. Raw HTTP status text ("Not Found"),
// status codes, and stack-ish strings must never reach a toast title.
const STATUS_FALLBACK: Record<number, string> = {
  400: 'The request was rejected. Please check the highlighted fields.',
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to do that.',
  404: 'That record could not be found.',
  409: 'That conflicts with an existing record.',
  413: 'That file is too large.',
  422: 'Some values are invalid. Please review the form.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'Something went wrong on our side. Please try again.',
  502: 'The service is temporarily unavailable. Please try again.',
  503: 'The service is temporarily unavailable. Please try again.',
};

const MAX_DETAIL_LENGTH = 160;

function bodyMessage(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const raw = (body as { message?: unknown }).message;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (Array.isArray(raw)) {
    const parts = raw.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
    if (parts.length) return parts.join(' ');
  }
  // ZodPipe reports a failed body as { _errors: [], field: { _errors: [...] } }.
  // Read that shape too: otherwise this returns nothing and the caller falls back
  // to the generic 400 copy, which never says which fields are missing.
  if (raw && typeof raw === 'object') {
    const issues: string[] = [];
    collectZodErrors(raw, issues);
    if (issues.length) {
      // Keep whole messages while they fit. The callers drop any detail longer
      // than MAX_DETAIL_LENGTH outright, so an over-long join would lose the lot.
      let out = '';
      for (const issue of issues) {
        const next = out ? `${out} ${issue}` : issue;
        if (next.length > MAX_DETAIL_LENGTH) break;
        out = next;
      }
      return out || `${issues[0].slice(0, MAX_DETAIL_LENGTH - 1)}…`;
    }
  }
  return undefined;
}

// Depth-first collection of Zod issue strings. Non-Zod objects (Nest's
// { error, message } bodies) carry no `_errors`, so they collect nothing and
// keep their existing generic fallback.
function collectZodErrors(node: unknown, out: string[]): void {
  if (!node || typeof node !== 'object') return;
  const n = node as { _errors?: unknown; [key: string]: unknown };
  if (Array.isArray(n._errors)) {
    for (const issue of n._errors) {
      if (typeof issue === 'string' && issue.trim()) out.push(issue.trim());
    }
  }
  for (const [key, value] of Object.entries(n)) {
    if (key !== '_errors' && value && typeof value === 'object') collectZodErrors(value, out);
  }
}

// Message stored on ApiError: the API's own message when it is short enough to
// show, otherwise a friendly description of the status.
export function apiErrorMessage(status: number, body: unknown): string {
  const detail = bodyMessage(body);
  if (detail && detail.length <= MAX_DETAIL_LENGTH) return detail;
  return STATUS_FALLBACK[status] ?? `The request failed (${status}). Please try again.`;
}

// Human copy for any thrown value — safe to put in a toast description.
export function humanizeError(err: unknown, fallback = 'Please try again.'): string {
  if (err instanceof ApiError) {
    const detail = bodyMessage(err.body);
    if (detail && detail.length <= MAX_DETAIL_LENGTH) return detail;
    return STATUS_FALLBACK[err.status] ?? fallback;
  }
  if (err instanceof Error) {
    const message = err.message?.trim();
    if (message && !/^API error\b/i.test(message) && !/^\d{3}\b/.test(message)) return message;
  }
  return fallback;
}
