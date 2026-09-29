import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TeamStatusBar } from './TeamStatusBar';
import type { TeamStatus, TeamStatusInput, TeamStaffAchievement } from '../../lib/team-api';

const STAFF: TeamStaffAchievement[] = [
  { userId: 'u1', name: 'Ana Admin', cases: 0, interventions: 0, referrals: 0, docs: 0, trackerDays: 0 },
  { userId: 'u2', name: 'Ben Social', cases: 0, interventions: 0, referrals: 0, docs: 0, trackerDays: 0 },
];

const STATUSES: TeamStatus[] = [
  { userId: 'u1', status: 'in_office', note: null, visibleTo: 'team', updatedAt: '2026-09-28T01:00:00.000Z' },
  { userId: 'u2', status: 'field_day', note: 'Bgy. Bigte', visibleTo: 'team', updatedAt: '2026-09-28T02:00:00.000Z' },
];

function renderBar(
  overrides: Partial<React.ComponentProps<typeof TeamStatusBar>> = {},
): { onSetStatus: ReturnType<typeof vi.fn> } {
  const onSetStatus = vi.fn();
  render(
    <TeamStatusBar
      statuses={STATUSES}
      staff={STAFF}
      myUserId="u1"
      onSetStatus={onSetStatus}
      {...overrides}
    />,
  );
  return { onSetStatus };
}

describe('TeamStatusBar visibility toggle', () => {
  it('sends visibleTo: team by default with the chosen status', async () => {
    const { onSetStatus } = renderBar();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Set my status' }));
    await user.click(await screen.findByRole('menuitem', { name: /On leave/i }));

    expect(onSetStatus).toHaveBeenCalledWith({
      status: 'on_leave',
      note: null,
      visibleTo: 'team',
    } satisfies TeamStatusInput);
  });

  it('sends visibleTo: team_coordinators after toggling the visibility select', async () => {
    const { onSetStatus } = renderBar();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Set my status' }));
    // Same widget vocabulary as the block editor (Team / Team + coordinators).
    await user.click(await screen.findByRole('combobox', { name: 'Status visibility' }));
    await user.click(await screen.findByRole('option', { name: 'Team + coordinators' }));
    await user.click(await screen.findByRole('menuitem', { name: /Remote/i }));

    expect(onSetStatus).toHaveBeenCalledWith({
      status: 'remote',
      note: null,
      visibleTo: 'team_coordinators',
    });
  });

  it('prefills the toggle from the stored status (edit round-trip)', async () => {
    const toggled: TeamStatus[] = [
      { userId: 'u1', status: 'in_office', note: null, visibleTo: 'team_coordinators', updatedAt: '2026-09-28T01:00:00.000Z' },
      { userId: 'u2', status: 'field_day', note: null, visibleTo: 'team', updatedAt: '2026-09-28T02:00:00.000Z' },
    ];
    const { onSetStatus } = renderBar({ statuses: toggled });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Set my status' }));
    const visibility = await screen.findByRole('combobox', { name: 'Status visibility' });
    expect(visibility).toHaveTextContent('Team + coordinators');

    await user.click(await screen.findByRole('menuitem', { name: /In office/i }));
    expect(onSetStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'in_office', visibleTo: 'team_coordinators' }),
    );
  });

  it('coordinators (canEdit false) get no dropdown at all — chips only', () => {
    renderBar({ canEdit: false });
    expect(screen.queryByRole('button', { name: 'Set my status' })).toBeNull();
    expect(screen.getByText('Ana Admin')).toBeTruthy();
    expect(screen.getByText('Ben Social')).toBeTruthy();
  });
});