import { ApiError } from './api-error';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const TOKEN_KEY = 'kapwa_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
const BASE_DELAYS_MS = [500, 1500, 4500] as const;
export const KAPWA_AUTH_LOGOUT_EVENT = 'kapwa:auth:logout';

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

// SWR's global fetcher receives the full queryKey tuple from queryKeys.* — join array parts with '/'.
function normalizePath(path: string | readonly unknown[]): string {
  if (Array.isArray(path)) {
    return '/' + path.filter((p) => p !== null && p !== undefined && p !== '').join('/');
  }
  return path;
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
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
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
    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: composedSignal,
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      throw new ApiError(res.status, errBody, res.statusText);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  const refresh = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refresh) {
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
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        window.dispatchEvent(
          new CustomEvent(KAPWA_AUTH_LOGOUT_EVENT, { detail: { reason: 'refresh_failed' } }),
        );
        return false;
      }
      const data = (await res.json()) as { accessToken?: string; refreshToken?: string };
      if (data.accessToken) localStorage.setItem(TOKEN_KEY, data.accessToken);
      if (data.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
      return true;
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      window.dispatchEvent(
        new CustomEvent(KAPWA_AUTH_LOGOUT_EVENT, { detail: { reason: 'refresh_network_error' } }),
      );
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function executeWithRetry<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body: unknown,
  signal: AbortSignal | undefined,
  isRetry: boolean = false,
  attempt: number = 0,
): Promise<T> {
  try {
    return await rawRequest<T>(method, path, body, signal);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && !isRetry) {
      const refreshed = await refreshToken();
      if (refreshed) {
        return executeWithRetry<T>(method, path, body, signal, true, attempt);
      }
      throw err;
    }
    const isRetryableError =
      err instanceof TypeError ||
      (err instanceof DOMException && err.name === 'AbortError' && !signal?.aborted);
    if (isRetryableError && method === 'GET' && attempt < MAX_RETRIES) {
      await sleep(delayForAttempt(attempt), signal);
      return executeWithRetry<T>(method, path, body, signal, isRetry, attempt + 1);
    }
    throw err;
  }
}

export type ApiPath = string | readonly unknown[];

export const api = {
  get: <T>(path: ApiPath, opts?: { signal?: AbortSignal }) =>
    executeWithRetry<T>('GET', path, undefined, opts?.signal),
  post: <T>(path: ApiPath, body?: unknown, opts?: { signal?: AbortSignal }) =>
    executeWithRetry<T>('POST', path, body, opts?.signal),
  put: <T>(path: ApiPath, body?: unknown, opts?: { signal?: AbortSignal }) =>
    executeWithRetry<T>('PUT', path, body, opts?.signal),
  del: <T>(path: ApiPath, opts?: { signal?: AbortSignal }) =>
    executeWithRetry<T>('DELETE', path, undefined, opts?.signal),
};

// FormData uploads (D-10 deferred — api client only handles JSON).
async function rawUpload(path: string, file: Blob, fileName: string): Promise<string> {
  const token = localStorage.getItem(TOKEN_KEY);
  const formData = new FormData();
  formData.append('file', file, fileName);
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const data = (await res.json()) as { url: string };
  return data.url;
}
export const uploadSignature = (file: Blob, fileName: string) =>
  rawUpload('/interventions/upload-signature', file, fileName);
export const uploadReceipt = (file: Blob, fileName: string) =>
  rawUpload('/interventions/upload-receipt', file, fileName);

export function dataURItoBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
  return new Blob([array], { type: mime });
}

// Blob downloads (D-10 deferred — api client only handles JSON).
export async function downloadCsrPdf(controlNo: string) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API_BASE}/csr/${controlNo}/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('PDF download failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement('a');
  a.href = url;
  a.download = `CSR-${controlNo}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportIrfPdf(id: string, legalBasis: string, password: string) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(
    `${API_BASE}/irf/${id}/export-pdf?legalBasis=${encodeURIComponent(legalBasis)}&password=${encodeURIComponent(password)}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (!res.ok) throw new Error(`PDF export failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement('a');
  a.href = url;
  a.download = `IRF-${id}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
