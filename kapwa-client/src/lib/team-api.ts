import { api } from './api';

// Thin typed wrappers over the Team Workspace REST endpoints
// (kapwa-server/src/team/*.controller.ts). Dates travel as YYYY-MM-DD
// strings everywhere — the same convention the server's parseDay helpers
// enforce — and ranges are inclusive server-side.

export interface TeamBlockInput {
  userId: string;
  blockDate: string;
  blockType: string;
  startTime?: string;
  endTime?: string;
  note?: string;
}

export interface TeamBlock {
  id: string;
  userId: string;
  blockDate: string;
  blockType: string;
  startTime?: string | null;
  endTime?: string | null;
  note?: string | null;
}

export interface TeamEventInput {
  title: string;
  startsAt: string;
  endsAt: string;
  /** null clears a stored repeat rule (PATCH — the server overwrites only when the field is present). */
  repeatRule?: Record<string, unknown> | null;
  visibleTo: string;
  location?: string;
  notes?: string;
}

export interface TeamEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  repeatRule?: Record<string, unknown> | null;
  visibleTo: string;
  location?: string | null;
  notes?: string | null;
}

export interface TeamStatusInput {
  status: string;
  note?: string | null;
}

export interface TeamStatus {
  userId: string;
  status: string;
  note?: string | null;
  updatedAt: string;
}

export interface TeamStaffAchievement {
  userId: string;
  name: string;
  cases: number;
  interventions: number;
  referrals: number;
  docs: number;
  trackerDays: number;
}

export interface AchievementsRollup {
  perStaff: TeamStaffAchievement[];
  range: { from: string; to: string };
}

export interface TeamSchedule {
  from: string;
  to: string;
  blocks: TeamBlock[];
  events: TeamEvent[];
}

const dateRange = (from: string, to: string) =>
  `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

// GET /team/blocks and GET /team/events: role-gated reads open to
// admin + social_worker + coordinator (coordinators are scoped server-side
// to their barangay staff / staff_coordinators events).
export const getBlocks = (from: string, to: string) =>
  api.get<TeamBlock[]>(`/team/blocks${dateRange(from, to)}`);

export const getEvents = (from: string, to: string) =>
  api.get<TeamEvent[]>(`/team/events${dateRange(from, to)}`);

/**
 * Merged schedule for a week grid.
 *
 * NOTE (2026-09-29): the server does NOT implement a merged `GET
 * /team/schedule` endpoint yet — only `GET /team/blocks` and `GET
 * /team/events` exist (verified against team-schedule.controller.ts /
 * office-events.controller.ts). getSchedule therefore merges both calls
 * client-side so the page can paint one grid from a single fn. When the
 * server gains the merged endpoint, replace the body with a thin
 * `api.get<TeamSchedule>('/team/schedule?...')` wrapper and delete the two
 * Promise.all lines.
 */
export const getSchedule = async (from: string, to: string): Promise<TeamSchedule> => {
  const [blocks, events] = await Promise.all([getBlocks(from, to), getEvents(from, to)]);
  return { from, to, blocks, events };
};

// Blocks CRUD — unsafe verbs are admin + social_worker only (server 403s
// coordinators before these run).
export const createBlock = (input: TeamBlockInput) =>
  api.post<TeamBlock>('/team/blocks', input);
export const updateBlock = (id: string, patch: Partial<TeamBlockInput>) =>
  api.patch<TeamBlock>(`/team/blocks/${id}`, patch);
export const deleteBlock = (id: string) =>
  api.del<{ deleted: boolean }>(`/team/blocks/${id}`);

// Events CRUD — same role matrix as blocks; deletes are hard + audited.
export const createEvent = (input: TeamEventInput) =>
  api.post<TeamEvent>('/team/events', input);
export const updateEvent = (id: string, patch: Partial<TeamEventInput>) =>
  api.patch<TeamEvent>(`/team/events/${id}`, patch);
export const deleteEvent = (id: string) =>
  api.del<{ deleted: boolean }>(`/team/events/${id}`);

// Whereabouts — own read/write (admin + social_worker), team board
// (admin + social_worker + coordinator).
export const getMyStatus = () => api.get<TeamStatus | null>('/team/status');
export const putStatus = (input: TeamStatusInput) =>
  api.put<TeamStatus>('/team/status', input);
export const getStatuses = () => api.get<TeamStatus[]>('/team/statuses');

// Derived per-staff rollup; both bounds are required (400 otherwise).
export const getAchievements = (from: string, to: string) =>
  api.get<AchievementsRollup>(`/team/achievements${dateRange(from, to)}`);