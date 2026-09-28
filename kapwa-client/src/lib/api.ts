import { ApiError } from './api-error';
import { apiErrorMessage } from './errors';
import { exportFileName } from './export-filename';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
const TOKEN_KEY = 'kapwa_token';
export const REFRESH_TOKEN_KEY = 'refresh_token';
export const LOGOUT_REASON_KEY = 'kapwa:logout-reason';
const TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
const BASE_DELAYS_MS = [500, 1500, 4500] as const;
export const KAPWA_AUTH_LOGOUT_EVENT = 'kapwa:auth:logout';
export const KAPWA_ACCESS_DENIED_EVENT = 'kapwa:access:denied';

export interface AccessDeniedDetail {
  message: string;
  path: string;
}

/**
 * A 403 is a policy decision, not a transport failure, and it is otherwise
 * invisible: SWR hands the error to its onError handler, and a page that only
 * renders `data` shows an empty table. Broadcast the refusal so a persistent
 * banner can say so on the user's behalf. Dispatched once at the request
 * boundary, which covers every caller including raw fetch/upload paths.
 */
function announceAccessDenied(err: ApiError, path: string): void {
  if (err.status !== 403) return;
  window.dispatchEvent(
    new CustomEvent<AccessDeniedDetail>(KAPWA_ACCESS_DENIED_EVENT, {
      detail: { message: err.message, path },
    }),
  );
}

/**
 * The double-submit CSRF guard (server src/common/csrf.guard.ts) boots the
 * csrf-token cookie on ANY request when it is absent, but still rejects the
 * request it booted on. That rejection is transient — the cookie was re-issued
 * in the same response — so a single immediate retry carries the fresh token.
 * Anything else (a real policy 403) must NOT be retried.
 */
function isCsrfRejection(err: ApiError): boolean {
  if (err.status !== 403) return false;
  const body = err.body as { message?: unknown } | null;
  const message =
    body && typeof body === 'object'
      ? (body as { message?: unknown }).message
      : undefined;
  return typeof message === 'string' && /csrf/i.test(message);
}

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function csrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]*)/);
  return match?.[1] ?? null;
}

/** Double-submit CSRF header for unsafe requests that bypass the api helpers. */
export function csrfHeaders(): Record<string, string> {
  const csrf = csrfToken();
  return csrf ? { 'X-CSRF-Token': csrf } : {};
}

// SWR's global fetcher receives the full queryKey tuple from queryKeys.*.
// Join array parts with '/' and serialize the last object element as query params.
export type ApiPath = string | readonly unknown[];

function normalizePath(path: string | readonly unknown[]): string {
  if (Array.isArray(path)) {
    const parts = [...path];
    let queryString = '';
    const last = parts[parts.length - 1];
    if (typeof last === 'object' && last !== null && !Array.isArray(last) && !(last instanceof Date)) {
      parts.pop();
      const entries = Object.entries(last as Record<string, unknown>)
        .filter(([_, v]) => v !== null && v !== undefined && v !== '');
      if (entries.length > 0) {
        queryString = '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
      }
    }
    return '/' + parts.filter((p) => p !== null && p !== undefined && p !== '').join('/') + queryString;
  }
  return path as string;
}

function jitteredDelay(baseMs: number): number {
  const jitter = baseMs * 0.2 * (Math.random() * 2 - 1);
  return Math.round(baseMs + jitter);
}

function delayForAttempt(attempt: number): number {
  return jitteredDelay(BASE_DELAYS_MS[attempt]);
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(t);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    }
  });
}

async function rawRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body: unknown,
  callerSignal: AbortSignal | undefined,
): Promise<T> {
  const normalized = normalizePath(path);
  const url = normalized.startsWith('http') ? normalized : `${API_BASE}${normalized}`;
  const internalController = new AbortController();
  const timeoutId = setTimeout(() => internalController.abort(), TIMEOUT_MS);
  const composedSignal = callerSignal
    ? AbortSignal.any([internalController.signal, callerSignal])
    : internalController.signal;

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (method !== 'GET') {
      const csrf = csrfToken();
      if (csrf) headers['X-CSRF-Token'] = csrf;
    }
    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: composedSignal,
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      const err = new ApiError(res.status, errBody, apiErrorMessage(res.status, errBody));
      // A CSRF rejection is self-healing: executeWithRetry re-issues this exact
      // request once with the cookie the guard just set. Announcing it here
      // would show a misleading "Access denied" banner for an action that then
      // succeeds — announce only when the retry is exhausted.
      if (!isCsrfRejection(err)) announceAccessDenied(err, normalized);
      throw err;
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Ends a session that can no longer be recovered: clears the tokens and tells
 * the auth context, which drops the user and lets ProtectedRoute redirect to
 * /login. Idempotent — it only fires when a token is actually present, so an
 * unauthenticated 401 (a stale background request after logout) cannot trigger
 * a spurious logout.
 */
function endSession(reason: string): void {
  const hadToken = Boolean(
    localStorage.getItem(TOKEN_KEY) || localStorage.getItem(REFRESH_TOKEN_KEY),
  );
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  if (!hadToken) return;
  localStorage.setItem(LOGOUT_REASON_KEY, reason);
  window.dispatchEvent(
    new CustomEvent(KAPWA_AUTH_LOGOUT_EVENT, { detail: { reason } }),
  );
}

async function refreshToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  const refresh = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refresh) {
    // Nothing to refresh with, so the session is already over. End it
    // explicitly: returning false alone left a dead access token in place and
    // the app stayed in the authenticated layout until a manual logout.
    endSession('session_expired');
    return false;
  }
  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      if (!res.ok) {
        endSession('session_expired');
        return false;
      }
      const data = (await res.json()) as { accessToken?: string; refreshToken?: string };
      if (data.accessToken) localStorage.setItem(TOKEN_KEY, data.accessToken);
      if (data.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
      return true;
    } catch {
      endSession('network_error');
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function executeWithRetry<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: ApiPath,
  body: unknown,
  signal: AbortSignal | undefined,
  isRetry: boolean = false,
  attempt: number = 0,
  csrfRetried: boolean = false,
): Promise<T> {
  const normalized = normalizePath(path);
  try {
    return await rawRequest<T>(method, normalized, body, signal);
  } catch (err) {
    /**
     * On 401, attempt /auth/refresh exactly once via single-flight pattern.
     * Concurrent 401s share the same refresh promise.
     * See SECURITY.md for the full flow.
     */
    if (err instanceof ApiError && err.status === 401) {
      if (!isRetry) {
        const refreshed = await refreshToken();
        if (refreshed) {
          return executeWithRetry<T>(method, normalized, body, signal, true, attempt, csrfRetried);
        }
      }
      // Unrecoverable 401: no refresh token, refresh rejected, or the retried
      // request was rejected again (e.g. the account was disabled). End the
      // session so the app leaves the authenticated layout and shows /login.
      endSession('session_expired');
      throw err;
    }
    // CSRF double-submit rejections are transient and unsafe-request-only: the
    // guard re-issued the cookie on the rejected response, so one immediate
    // retry of the SAME request (same body) carries the fresh token. Never
    // loops — csrfRetried survives every recursion path above and below.
    if (err instanceof ApiError && isCsrfRejection(err) && method !== 'GET' && !csrfRetried) {
      return executeWithRetry<T>(method, normalized, body, signal, isRetry, attempt, true);
    }
    if (err instanceof ApiError && isCsrfRejection(err) && csrfRetried) {
      // The retry was rejected too (cookie not re-issued or genuinely denied):
      // surface it as the ordinary access-denied refusal.
      announceAccessDenied(err, normalized);
    }
    const isRetryableError =
      err instanceof TypeError ||
      (err instanceof DOMException && err.name === 'AbortError' && !signal?.aborted);
    if (isRetryableError && method === 'GET' && attempt < MAX_RETRIES) {
      await sleep(delayForAttempt(attempt), signal);
      return executeWithRetry<T>(method, normalized, body, signal, isRetry, attempt + 1, csrfRetried);
    }
    throw err;
  }
}

export const api = {
  get: <T>(path: ApiPath, opts?: { signal?: AbortSignal }) =>
    executeWithRetry<T>('GET', path, undefined, opts?.signal),
  post: <T>(path: ApiPath, body?: unknown, opts?: { signal?: AbortSignal }) =>
    executeWithRetry<T>('POST', path, body, opts?.signal),
  put: <T>(path: ApiPath, body?: unknown, opts?: { signal?: AbortSignal }) =>
    executeWithRetry<T>('PUT', path, body, opts?.signal),
  patch: <T>(path: ApiPath, body?: unknown, opts?: { signal?: AbortSignal }) =>
    executeWithRetry<T>('PATCH', path, body, opts?.signal),
  del: <T>(path: ApiPath, opts?: { signal?: AbortSignal }) =>
    executeWithRetry<T>('DELETE', path, undefined, opts?.signal),
  url: (path: string) => `${API_BASE}${normalizePath(path)}`,
  upload: async <T>(path: string, formData: FormData, opts?: { signal?: AbortSignal }): Promise<T> => {
    const token = getToken();
    const url = `${API_BASE}${normalizePath(path)}`;
    // CSRF retry: the guard re-issues the cookie on the 403 it boots on, so one
    // extra attempt carries the fresh token. The FormData body is replayable.
    let csrfRetried = false;
    for (;;) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...csrfHeaders() },
        body: formData,
        signal: opts?.signal,
      });
      if (res.ok) return res.json();
      const errBody = await res.json().catch(() => null);
      const err = new ApiError(res.status, errBody, apiErrorMessage(res.status, errBody));
      if (isCsrfRejection(err) && !csrfRetried) {
        csrfRetried = true;
        continue;
      }
      announceAccessDenied(err, url);
      throw err;
    }
  },
};

export async function uploadWithProgress<T>(
  path: string,
  formData: FormData,
  onProgress: (percent: number) => void,
  opts?: { signal?: AbortSignal },
): Promise<T> {
  const token = getToken();
  const url = `${API_BASE}${normalizePath(path)}`;
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    // CSRF retry: the guard re-issues the cookie on the 403 it boots on, so one
    // re-send of the SAME FormData carries the fresh token. csrfHeaders() is
    // re-read per attempt so the retry picks up the newly set cookie.
    let csrfRetried = false;
    const sendAttempt = () => {
      xhr.open('POST', url);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      const csrf = csrfToken();
      if (csrf) xhr.setRequestHeader('X-CSRF-Token', csrf);
      xhr.send(formData);
    };
    if (opts?.signal) {
      opts.signal.addEventListener('abort', () => xhr.abort());
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          resolve(undefined as unknown as T);
        }
        return;
      }
      let body: unknown = null;
      try { body = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      const err = new ApiError(xhr.status, body, apiErrorMessage(xhr.status, body));
      if (isCsrfRejection(err) && !csrfRetried) {
        csrfRetried = true;
        sendAttempt();
        return;
      }
      reject(err);
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.ontimeout = () => reject(new Error('Upload timed out'));
    sendAttempt();
  });
}

// FormData uploads (D-10 deferred — api client only handles JSON).
async function rawUpload(path: string, file: Blob, fileName: string): Promise<string> {
  const token = localStorage.getItem(TOKEN_KEY);
  const formData = new FormData();
  formData.append('file', file, fileName);
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...csrfHeaders() },
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const data = (await res.json()) as { url: string };
  return data.url;
}
export const uploadSignature = (file: Blob, fileName: string) =>
  rawUpload('/minio/upload', file, fileName);
export const uploadReceipt = (file: Blob, fileName: string) =>
  rawUpload('/minio/upload', file, fileName);

export function dataURItoBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
  return new Blob([array], { type: mime });
}

export async function downloadCsrPdf(caseId: string) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(
    `${API_BASE}/cases/${caseId}/csr-pdf`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (!res.ok) throw new Error(`CSR export failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement('a');
  a.href = url;
  a.download = dispositionFilename(res, exportFileName('CSR', caseId));
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadGisPdf(caseId: string) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(
    `${API_BASE}/cases/${caseId}/gis-pdf`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (!res.ok) throw new Error(`GIS export failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement('a');
  a.href = url;
  a.download = dispositionFilename(res, exportFileName('GIS', caseId));
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadAccessCardPdf(beneficiaryId: string) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(
    `${API_BASE}/access-cards/beneficiary/${beneficiaryId}/access-card-pdf`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (!res.ok) throw new Error(`Access Card export failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement('a');
  a.href = url;
  a.download = dispositionFilename(res, exportFileName('ACCESS CARD', beneficiaryId));
  a.click();
  URL.revokeObjectURL(url);
}

export function dispositionFilename(res: Response, fallback: string): string {
  const disposition = res.headers?.get('Content-Disposition') || '';
  const match = /filename="([^"]+)"/.exec(disposition);
  return match?.[1] || fallback;
}

export async function downloadFilingDoc(id: string, fallbackName = 'document'): Promise<void> {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API_BASE}/filing/${id}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Document download failed: ${res.status}`);
  const blob = await res.blob();
  const filename = dispositionFilename(res, fallbackName);
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Extract the filing document id from a `/filing/:id/download` URL (the shape
 * server-stored fields like certificateUrl / pettyCashVoucherUrl hold), so the
 * authenticated download helper can be used instead of opening the raw API URL
 * in a new tab — a bare tab cannot attach the localStorage Bearer token and
 * would 401.
 */
export function filingDocIdFromUrl(url: string): string | null {
  const match = /\/filing\/([^/]+)\/download/.exec(url);
  return match?.[1] ?? null;
}

export async function getFilingObjectUrl(id: string): Promise<string> {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API_BASE}/filing/${id}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Document fetch failed: ${res.status}`);
  return URL.createObjectURL(await res.blob());
}

// Public announcement photos are served by the API (not the SPA origin), so the
// URL must carry the API base. Built as a plain relative path, the SPA answered
// 200 text/html and every cover/photo rendered as a broken image.
export function publicAnnouncementPhotoUrl(photoId: string): string {
  return `${API_BASE}/announcements/public/photo/${photoId}`;
}

export async function exportIrfPdf(id: string, legalBasis: string, password: string) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(
    `${API_BASE}/irf/${id}/export-pdf`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...csrfHeaders(),
      },
      body: JSON.stringify({ legalBasis, password }),
    },
  );
  if (!res.ok) throw new Error(`PDF export failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement('a');
  a.href = url;
  a.download = dispositionFilename(res, exportFileName('IRF', id));
  a.click();
  URL.revokeObjectURL(url);
}

export type CertificateType = 'eligibility' | 'referral';

export async function downloadCertificate(
  type: CertificateType,
  data: { fullName: string; address?: string; date: string; details?: string },
) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API_BASE}/export/certificate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...csrfHeaders(),
    },
    body: JSON.stringify({ type, ...data }),
  });
  if (!res.ok) throw new Error(`Certificate export failed: ${res.status}`);
  const blob = await res.blob();
  const filename = dispositionFilename(res, `certificate-${type}.pdf`);
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadMonthlyFunds(month: string, startDate?: string, endDate?: string) {
  const token = localStorage.getItem(TOKEN_KEY);
  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  if (!startDate && !endDate) params.set('month', month);
  const res = await fetch(`${API_BASE}/export/monthly-funds?${params.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Fund export failed: ${res.status}`);
  const blob = await res.blob();
  const filename = dispositionFilename(res, `fund-utilization-${startDate ?? month}.xlsx`);
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadSummaryReport(year?: number, quarter?: number): Promise<void> {
  const token = getToken();
  const params = new URLSearchParams();
  if (year) params.set('year', String(year));
  if (quarter) params.set('quarter', String(quarter));
  const res = await fetch(`${API_BASE}/reports/summary?${params.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error((await res.text()) || `Export failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `summary-report-${year ?? 'current'}-Q${quarter ?? ''}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadAnalyticsCsv(path: string, fallbackFilename: string) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Analytics export failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement('a');
  a.href = url;
  a.download = dispositionFilename(res, fallbackFilename);
  a.click();
  URL.revokeObjectURL(url);
}
