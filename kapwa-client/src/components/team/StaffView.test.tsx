import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import { StaffView } from './StaffView';
import { weekStart, addDays, localIsoDay } from './team-utils';
import type { TeamStaffAchievement, TeamStatus } from '../../lib/team-api';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));

vi.mock('../../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    put: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
  },
}));

const PER_STAFF: TeamStaffAchievement[] = [
  { userId: 'u1', name: 'Ana Admin', cases: 2, interventions: 1, referrals: 0, docs: 1, trackerDays: 2 },
  { userId: 'u2', name: 'Ben Social', cases: 0, interventions: 3, referrals: 1, docs: 0, trackerDays: 1 },
];

const STATUSES: TeamStatus[] = [
  { userId: 'u1', status: 'in_office', note: 'Intake', visibleTo: 'team', updatedAt: '2026-09-28T01:00:00.000Z' },
  // u2 has no status row → "No status set".
];

function renderStaff() {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
      <StaffView staff={PER_STAFF} statuses={STATUSES} />
    </SWRConfig>,
  );
}

// Range bounds computed at test time — the picker defaults to the current
// week, so the first fetch must use these exact inclusive bounds.
const weekFrom = localIsoDay(weekStart(new Date()));
const weekTo = localIsoDay(addDays(weekStart(new Date()), 6));

describe('StaffView', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValue({
      perStaff: PER_STAFF,
      range: { from: weekFrom, to: weekTo },
    });
  });

  it('renders one card per staff: initials, name, live status chip + note and last-updated', async () => {
    renderStaff();

    expect(screen.getByText('AA')).toBeTruthy(); // Ana Admin initials
    expect(screen.getByText('BS')).toBeTruthy(); // Ben Social initials
    expect(screen.getByText('Ana Admin')).toBeTruthy();
    expect(screen.getByText('Ben Social')).toBeTruthy();

    // Ana: status chip + note + last-updated (fixture is Sep 28 in every TZ).
    expect(screen.getByText('In office — Intake')).toBeTruthy();
    expect(screen.getByText(/Updated .*Sep 28/)).toBeTruthy();
    // Ben: no status row.
    expect(screen.getByText('No status set')).toBeTruthy();
  });

  it('defaults the achievements range to the current week and auto-selects the first member', async () => {
    renderStaff();

    await waitFor(() =>
      expect(mockApiGet).toHaveBeenCalledWith(`/team/achievements?from=${weekFrom}&to=${weekTo}`),
    );

    const region = await screen.findByRole('region', { name: 'Achievements for Ana Admin' });
    expect(within(region).getByText('Achievements — Ana Admin')).toBeTruthy();
    expect(within(region).getByTestId('stat-cases')).toHaveTextContent('2');
    expect(within(region).getByTestId('stat-interventions')).toHaveTextContent('1');
  });

  it('switches the panel when a staff card is selected (zero counts render too)', async () => {
    renderStaff();

    fireEvent.click(screen.getByRole('button', { name: 'View achievements for Ben Social' }));

    const region = await screen.findByRole('region', { name: 'Achievements for Ben Social' });
    expect(within(region).getByText('Achievements — Ben Social')).toBeTruthy();
    expect(within(region).getByTestId('stat-cases')).toHaveTextContent('0');
    expect(within(region).getByTestId('stat-interventions')).toHaveTextContent('3');
    expect(within(region).getByTestId('stat-referrals')).toHaveTextContent('1');
    expect(within(region).getByTestId('stat-docs')).toHaveTextContent('0');
    expect(within(region).getByTestId('stat-trackerDays')).toHaveTextContent('1');
  });

  it('range picker switches to this month and refetches with month bounds', async () => {
    renderStaff();
    const user = userEvent.setup();

    const now = new Date();
    const monthFrom = localIsoDay(new Date(now.getFullYear(), now.getMonth(), 1));
    const monthTo = localIsoDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));

    await user.click(await screen.findByRole('combobox', { name: 'Achievements range' }));
    await user.click(await screen.findByRole('option', { name: 'This month' }));

    await waitFor(() =>
      expect(mockApiGet).toHaveBeenCalledWith(`/team/achievements?from=${monthFrom}&to=${monthTo}`),
    );
  });

  it('exposes no status setter (coordinator read-only is inherent — the view only renders state)', async () => {
    renderStaff();

    expect(screen.queryByRole('button', { name: /Set my status/i })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /On leave/i })).toBeNull();
  });

  it('shows an empty-state panel when the roster is empty', () => {
    render(
      <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
        <StaffView staff={[]} statuses={[]} />
      </SWRConfig>,
    );

    expect(screen.getByText('No staff to show.')).toBeTruthy();
    expect(screen.getByText('Select a staff member to see their achievements.')).toBeTruthy();
  });
});