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
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
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
    // 401 handling: refresh + retry once
    if (err instanceof ApiError && err.status === 401 && !isRetry) {
      const refreshed = await refreshToken();
      if (refreshed) {
        return executeWithRetry<T>(method, path, body, signal, true, attempt);
      }
      throw err;
    }
    // Retry policy: only network failure or internal-timeout abort, only on GET
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

export const api = {
  get: <T>(path: string, opts?: { signal?: AbortSignal }) =>
    executeWithRetry<T>('GET', path, undefined, opts?.signal),
  post: <T>(path: string, body?: unknown, opts?: { signal?: AbortSignal }) =>
    executeWithRetry<T>('POST', path, body, opts?.signal),
  put: <T>(path: string, body?: unknown, opts?: { signal?: AbortSignal }) =>
    executeWithRetry<T>('PUT', path, body, opts?.signal),
  del: <T>(path: string, opts?: { signal?: AbortSignal }) =>
    executeWithRetry<T>('DELETE', path, undefined, opts?.signal),
};

// Backwards-compat shims for the legacy wrappers still imported by pages
// that have not yet migrated to api.get/post/put/del (D-01 migration in Plan 14-02/14-03).
// Each shim is a one-line delegate to the new client. Do not add new code here.
export const getCases = (status?: string, signal?: AbortSignal) =>
  api.get(status ? `/cases?status=${encodeURIComponent(status)}` : '/cases', { signal });
export const getDashboard = () => api.get('/dashboard');
export const requestReview = (id: string) => api.put(`/cases/${id}/request-review`);
export const disburseCase = (id: string) => api.put(`/cases/${id}/disburse`, { status: 'disbursed' });
export const closeCase = (id: string) => api.put(`/cases/${id}/close`);
export const submitIntake = (data: Record<string, unknown>) => api.post('/intake', data);
export const getBeneficiaries = (params?: { search?: string; category?: string; barangay?: string; page?: number; limit?: number }) => {
  const q = new URLSearchParams();
  if (params?.search) q.set('search', params.search);
  if (params?.category) q.set('category', params.category);
  if (params?.barangay) q.set('barangay', params.barangay);
  if (params?.page) q.set('page', String(params.page));
  if (params?.limit) q.set('limit', String(params.limit));
  const qs = q.toString();
  return api.get(`/beneficiaries${qs ? '?' + qs : ''}`);
};
export const getBeneficiary = (id: string, signal?: AbortSignal) => api.get(`/beneficiaries/${id}`, { signal });
export const getFamilyGraph = (beneficiaryId: string, signal?: AbortSignal) =>
  api.get(`/beneficiaries/${beneficiaryId}/family-graph`, { signal });
export const createIntervention = (data: Record<string, unknown>) => api.post('/interventions', data);
export const getCaseTrackerLog = (date?: string) => api.get(`/tracker/daily${date ? '?date=' + date : ''}`);
export const assignCard = (beneficiaryId: string) => api.post(`/access-cards/assign/${beneficiaryId}`);

// Blob/FormData endpoints stay on raw fetch — the JSON-only api client can't handle them.
// These shims are kept for backwards compat; they use the same bearer-header pattern internally.
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
export const uploadSignature = (file: Blob, fileName: string) => rawUpload('/interventions/upload-signature', file, fileName);
export const uploadReceipt = (file: Blob, fileName: string) => rawUpload('/interventions/upload-receipt', file, fileName);

export function dataURItoBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
  return new Blob([array], { type: mime });
}

// ===== CSR =====
export const getCsrRecords = (signal?: AbortSignal) => api.get('/csr', { signal });
export const getCsrRecord = (id: string) => api.get(`/csr/${id}`);
export const createCsrRecord = (data: Record<string, unknown>) => api.post('/csr', data);
export const updateCsrRecord = (id: string, data: Record<string, unknown>) => api.put(`/csr/${id}`, data);
export const deleteCsrRecord = (id: string) => api.del(`/csr/${id}`);

export const getInterventions = (caseId?: string) =>
  api.get(`/interventions${caseId ? '?caseId=' + caseId : ''}`);

export const updateCaseDocuments = (id: string, data: { certificateUrl?: string; pettyCashVoucherUrl?: string }) =>
  api.put(`/cases/${id}/documents`, data);
export const approveCase = (id: string, status: string, signature?: string) =>
  api.put(`/cases/${id}/approve`, { status, signature });
export const getNotificationPreferences = (signal?: AbortSignal) => api.get('/notifications/preferences', { signal });
export const updateNotificationPreferences = (data: { channel: string; category: string; optedIn: boolean }) =>
  api.put('/notifications/preferences', data);

// Blob download stays on raw fetch — needs URL.createObjectURL flow.
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

export const getCase = (id: string) => api.get(`/cases/${id}`);
export const bulkApprove = (ids: string[], signature?: string) =>
  api.post('/cases/bulk-approve', { ids, signature });
export const setupMfa = () => api.post('/auth/mfa/setup');
export const enableMfa = (code: string) => api.post('/auth/mfa/enable', { code });
export const disableMfa = (password: string) => api.post('/auth/mfa/disable', { password });

export const getMayorReports = () => api.get('/dashboard/reports/mayor');
export const getIrfRecords = (signal?: AbortSignal) => api.get('/irf', { signal });
export const createIrf = (data: Record<string, unknown>) => api.post('/irf', data);
export const exportIrfJson = (id: string, legalBasis: string) =>
  api.get(`/irf/${id}/export-json?legalBasis=${encodeURIComponent(legalBasis)}`);

// Blob download stays on raw fetch
export async function exportIrfPdf(id: string, legalBasis: string, password: string) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API_BASE}/irf/${id}/export-pdf?legalBasis=${encodeURIComponent(legalBasis)}&password=${encodeURIComponent(password)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`PDF export failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement('a');
  a.href = url;
  a.download = `IRF-${id}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export const getIrfCase = (id: string) => api.get(`/irf/${id}`);
export const referToPnp = (id: string) => api.put(`/irf/${id}/refer-pnp`);
export const referToWcpd = (id: string) => api.put(`/irf/${id}/refer-wcpd`);
export const dismissIrf = (id: string, reason: string) => api.put(`/irf/${id}/dismiss`, { reason });
export const closeIrf = (id: string) => api.put(`/irf/${id}/close`);
export const decryptNarration = (id: string, legalBasis: string) => api.post(`/irf/${id}/decrypt`, { legalBasis });

export const getPrograms = () => api.get('/programs');
export const createProgram = (data: Record<string, unknown>) => api.post('/programs', data);
export const getBeneficiaryCard = (beneficiaryId: string) => api.get(`/access-cards/beneficiary/${beneficiaryId}/card`);

export const updateProgram = (id: string, data: Record<string, unknown>) => api.put(`/programs/${id}`, data);
export const deleteProgram = (id: string) => api.del(`/programs/${id}`);

export const getProgramAssignments = (caseId?: string) =>
  api.get(`/program-assignments${caseId ? '?caseId=' + caseId : ''}`);
export const getProgramAssignment = (id: string) => api.get(`/program-assignments/${id}`);
export const approveAssignmentStep = (id: string, stepOrder: number) =>
  api.post(`/program-assignments/${id}/steps/${stepOrder}/approve`, { stepOrder });
export const rejectAssignmentStep = (id: string, stepOrder: number, remarks: string) =>
  api.post(`/program-assignments/${id}/steps/${stepOrder}/reject`, { stepOrder, remarks });
export const overrideAssignmentStep = (id: string, stepOrder: number, overrideStatus: 'approved' | 'rejected', remarks: string) =>
  api.post(`/program-assignments/${id}/steps/${stepOrder}/override`, { stepOrder, overrideStatus, remarks });

export const bulkExport = (ids: string[], format: 'csv' | 'pdf', masked?: boolean, unmaskReason?: string | null) =>
  api.post('/cases/bulk-export', { ids, format, masked, unmaskReason });
export const revokeConsent = (beneficiaryId: string, reason?: string) =>
  api.post(`/beneficiaries/${beneficiaryId}/consent/revoke`, { reason });
export const verifyHashChains = () => api.get('/audit/verify-all');
export const getConsentLedger = (beneficiaryId: string) => api.get(`/beneficiaries/${beneficiaryId}/consent`);
export const unmaskIrfNames = (id: string, legalBasis: string) =>
  api.get(`/irf/${id}/unmask-names?legalBasis=${encodeURIComponent(legalBasis)}`);
