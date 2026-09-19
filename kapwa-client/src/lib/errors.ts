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
  return undefined;
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
