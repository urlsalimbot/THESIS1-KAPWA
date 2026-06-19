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

export async function getBeneficiaries() {
  return apiFetch('/beneficiaries');
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

export async function getConsentLedger(beneficiaryId: string) {
  return apiFetch(`/beneficiaries/${beneficiaryId}/consent`);
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
