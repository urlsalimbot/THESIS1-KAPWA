const API = 'http://localhost:3000/api';

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getCases(status?: string) {
  const q = status ? `?status=${status}` : '';
  return apiFetch(`/cases${q}`);
}

export async function getCase(id: string) {
  return apiFetch(`/cases/${id}`);
}

export async function createCase(data: any) {
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

export async function getBeneficiary(id: string) {
  return apiFetch(`/beneficiaries/${id}`);
}

export async function getInterventions(caseId?: string) {
  const q = caseId ? `?caseId=${caseId}` : '';
  return apiFetch(`/interventions${q}`);
}

export async function createIntervention(data: any) {
  return apiFetch('/interventions', { method: 'POST', body: JSON.stringify(data) });
}

export async function getPrograms() {
  return apiFetch('/programs');
}

export async function getConsentLedger(beneficiaryId: string) {
  return apiFetch(`/beneficiaries/${beneficiaryId}/consent`);
}
