const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export async function apiFetch(path: string, options: RequestInit & { signal?: AbortSignal } = {}) {
  const token = localStorage.getItem('kapwa_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getCases(status?: string, signal?: AbortSignal) {
  const q = status ? `?status=${status}` : '';
  return apiFetch(`/cases${q}`, { signal });
}

export async function getCase(id: string) {
  return apiFetch(`/cases/${id}`);
}

export async function createCase(data: Record<string, unknown>) {
  return apiFetch('/cases', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateCaseStatus(id: string, status: string) {
  return apiFetch(`/cases/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

export async function getDashboard() {
  return apiFetch('/dashboard');
}

export async function getBeneficiaries(params?: {
  search?: string;
  category?: string;
  barangay?: string;
  page?: number;
  limit?: number;
}) {
  const q = new URLSearchParams();
  if (params?.search) q.set('search', params.search);
  if (params?.category) q.set('category', params.category);
  if (params?.barangay) q.set('barangay', params.barangay);
  if (params?.page) q.set('page', String(params.page));
  if (params?.limit) q.set('limit', String(params.limit));
  const qs = q.toString();
  return apiFetch(`/beneficiaries${qs ? '?' + qs : ''}`);
}

export async function getBeneficiary(id: string, signal?: AbortSignal) {
  return apiFetch(`/beneficiaries/${id}`, { signal });
}

export async function getInterventions(caseId?: string) {
  const q = caseId ? `?caseId=${caseId}` : '';
  return apiFetch(`/interventions${q}`);
}

export async function createIntervention(data: Record<string, unknown>) {
  return apiFetch('/interventions', { method: 'POST', body: JSON.stringify(data) });
}

export async function getPrograms() {
  return apiFetch('/programs');
}

// ===== Programs =====
export async function createProgram(data: Record<string, unknown>) {
  return apiFetch('/programs', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateProgram(id: string, data: Record<string, unknown>) {
  return apiFetch(`/programs/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteProgram(id: string) {
  return apiFetch(`/programs/${id}`, { method: 'DELETE' });
}

export async function getConsentLedger(beneficiaryId: string) {
  return apiFetch(`/beneficiaries/${beneficiaryId}/consent`);
}

export async function revokeConsent(beneficiaryId: string, reason?: string) {
  return apiFetch(`/beneficiaries/${beneficiaryId}/consent/revoke`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

// ===== CSR =====
export async function getCsrRecords(signal?: AbortSignal) {
  return apiFetch('/csr', { signal });
}
export async function getCsrRecord(id: string) {
  return apiFetch(`/csr/${id}`);
}
export async function createCsrRecord(data: Record<string, unknown>) {
  return apiFetch('/csr', { method: 'POST', body: JSON.stringify(data) });
}
export async function updateCsrRecord(id: string, data: Record<string, unknown>) {
  return apiFetch(`/csr/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}
export async function deleteCsrRecord(id: string) {
  return apiFetch(`/csr/${id}`, { method: 'DELETE' });
}
export async function downloadCsrPdf(controlNo: string) {
  const token = localStorage.getItem('kapwa_token');
  const res = await fetch(`${API}/csr/${controlNo}/pdf`, {
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

export async function updateCaseDocuments(id: string, data: { certificateUrl?: string; pettyCashVoucherUrl?: string }) {
  return apiFetch(`/cases/${id}/documents`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function approveCase(id: string, status: string, signature?: string) {
  return apiFetch(`/cases/${id}/approve`, { method: 'PATCH', body: JSON.stringify({ status, signature }) });
}

// ===== FSM transition helpers =====
export async function requestReview(id: string) {
  return apiFetch(`/cases/${id}/request-review`, { method: 'PATCH' });
}

export async function disburseCase(id: string) {
  return apiFetch(`/cases/${id}/disburse`, { method: 'PATCH', body: JSON.stringify({ status: 'disbursed' }) });
}

export async function closeCase(id: string) {
  return apiFetch(`/cases/${id}/close`, { method: 'PATCH' });
}

export async function overrideCaseStatus(id: string, status: string, reason: string) {
  return apiFetch(`/cases/${id}/override-status`, { method: 'PATCH', body: JSON.stringify({ status, reason }) });
}

export async function getFamilyGraph(beneficiaryId: string, signal?: AbortSignal) {
  return apiFetch(`/beneficiaries/${beneficiaryId}/family-graph`, { signal });
}

export async function setupMfa() {
  return apiFetch('/auth/mfa/setup', { method: 'POST' });
}

export async function enableMfa(code: string) {
  return apiFetch('/auth/mfa/enable', { method: 'POST', body: JSON.stringify({ code }) });
}

export async function disableMfa(password: string) {
  return apiFetch('/auth/mfa/disable', { method: 'POST', body: JSON.stringify({ password }) });
}

export async function verifyMfa(tempToken: string, code: string) {
  return apiFetch('/auth/mfa/verify', { method: 'POST', body: JSON.stringify({ tempToken, code }) });
}

export async function createUser(data: { email: string; password: string; role: string; full_name?: string; phone?: string; assigned_barangay?: string; permitted_barangays?: string[] }): Promise<any> {
  const token = localStorage.getItem('kapwa_token');
  const res = await fetch(`${API}/users`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create user: ${res.status}`);
  return res.json();
}

export async function submitIntake(data: Record<string, unknown>) {
  return apiFetch('/intake', { method: 'POST', body: JSON.stringify(data) });
}

// ===== Signature / Receipt upload =====
export async function uploadSignature(file: Blob, fileName: string): Promise<string> {
  const token = localStorage.getItem('kapwa_token');
  const formData = new FormData();
  formData.append('file', file, fileName);
  const res = await fetch(`${API}/interventions/upload-signature`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) throw new Error('Signature upload failed');
  const data = await res.json();
  return data.url;
}

export async function uploadReceipt(file: Blob, fileName: string): Promise<string> {
  const token = localStorage.getItem('kapwa_token');
  const formData = new FormData();
  formData.append('file', file, fileName);
  const res = await fetch(`${API}/interventions/upload-receipt`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) throw new Error('Receipt upload failed');
  const data = await res.json();
  return data.url;
}

export function dataURItoBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
  return new Blob([array], { type: mime });
}

// ===== Case Tracker Log =====
export async function getCaseTrackerLog(date?: string) {
  const q = date ? `?date=${date}` : '';
  return apiFetch(`/tracker/daily${q}`);
}

// ===== Access Card API =====
export async function assignCard(beneficiaryId: string) {
  return apiFetch(`/access-cards/assign/${beneficiaryId}`, { method: 'POST' });
}

export async function getBeneficiaryCard(beneficiaryId: string) {
  return apiFetch(`/access-cards/beneficiary/${beneficiaryId}/card`);
}
