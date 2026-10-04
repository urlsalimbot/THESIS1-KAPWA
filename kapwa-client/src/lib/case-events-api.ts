import { api } from './api';

export type CaseEventType = 'court_hearing' | 'home_visit';

export interface CaseEvent {
  id: string;
  caseId: string;
  eventType: string;
  attended?: boolean | null;
  title?: string | null;
  venue?: string | null;
  eventDate: string;
  startTime?: string | null;
  endTime?: string | null;
  notes?: string | null;
  status: string;
}

export interface CaseEventInput {
  eventType: CaseEventType;
  attended?: boolean | null;
  title?: string | null;
  venue?: string | null;
  eventDate: string;
  startTime?: string | null;
  endTime?: string | null;
  notes?: string | null;
}

export const getCaseEvents = (caseId: string) => api.get<CaseEvent[]>(`/cases/${caseId}/events`);
export const createCaseEvent = (caseId: string, input: CaseEventInput) => api.post<CaseEvent>(`/cases/${caseId}/events`, input);
export const updateCaseEvent = (caseId: string, eventId: string, patch: Partial<CaseEventInput> & { status?: string }) =>
  api.patch<CaseEvent>(`/cases/${caseId}/events/${eventId}`, patch);
export const deleteCaseEvent = (caseId: string, eventId: string) => api.del<{ deleted: boolean }>(`/cases/${caseId}/events/${eventId}`);