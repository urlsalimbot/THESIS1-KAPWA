import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IncomingInvitesPanel } from './IncomingInvitesPanel';
import type { TeamInvite } from '../../lib/team-api';
import { weekStart, addDays, localIsoDay } from './team-utils';

const WEEK_FROM = localIsoDay(weekStart(new Date()));
const WEEK_TO = localIsoDay(addDays(weekStart(new Date()), 6));

const INVITES: TeamInvite[] = [
  {
    id: 'i1',
    fromUserId: 'u2',
    toUserId: 'u1',
    inviteDate: WEEK_FROM,
    blockType: 'home_visit',
    note: 'FDS at Bgy. Bigte',
    status: 'pending',
    createdAt: '2026-09-28T01:00:00.000Z',
    senderName: 'Ben Social',
  },
  {
    id: 'i2',
    fromUserId: 'u3',
    toUserId: 'u1',
    inviteDate: WEEK_TO,
    blockType: 'fortnight_errand',
    note: null,
    status: 'pending',
    createdAt: '2026-09-28T02:00:00.000Z',
    senderName: 'Carla Worker',
  },
];

function renderPanel(
  overrides: Partial<React.ComponentProps<typeof IncomingInvitesPanel>> = {},
): { onAccept: ReturnType<typeof vi.fn>; onDecline: ReturnType<typeof vi.fn> } {
  const onAccept = vi.fn();
  const onDecline = vi.fn();
  render(
    <IncomingInvitesPanel invites={INVITES} onAccept={onAccept} onDecline={onDecline} {...overrides} />,
  );
  return { onAccept, onDecline };
}

describe('IncomingInvitesPanel', () => {
  it('shows the pending count badge on the bell', () => {
    renderPanel();
    const bell = screen.getByRole('button', { name: 'Incoming schedule suggestions' });
    expect(within(bell).getByText('2')).toBeTruthy();
  });

  it('lists each pending invite with sender, date, type and note', async () => {
    renderPanel();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Incoming schedule suggestions' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('From Ben Social')).toBeTruthy();
    expect(within(dialog).getByText(/Home visit/)).toBeTruthy();
    expect(within(dialog).getByText('FDS at Bgy. Bigte')).toBeTruthy();
    expect(within(dialog).getByText('From Carla Worker')).toBeTruthy();
  });

  it('Accept fires onAccept with the invite id', async () => {
    const { onAccept } = renderPanel();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Incoming schedule suggestions' }));
    const dialog = await screen.findByRole('dialog');
    const row = within(dialog).getByTestId('invite-row-i1');
    await user.click(within(row).getByRole('button', { name: /Accept/i }));

    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onAccept).toHaveBeenCalledWith('i1');
  });

  it('Decline fires onDecline with the invite id', async () => {
    const { onDecline } = renderPanel();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Incoming schedule suggestions' }));
    const dialog = await screen.findByRole('dialog');
    const row = within(dialog).getByTestId('invite-row-i2');
    await user.click(within(row).getByRole('button', { name: /Decline/i }));

    expect(onDecline).toHaveBeenCalledTimes(1);
    expect(onDecline).toHaveBeenCalledWith('i2');
  });

  it('hides the badge and shows the empty state with no pending invites', async () => {
    renderPanel({ invites: [] });
    const user = userEvent.setup();

    const bell = screen.getByRole('button', { name: 'Incoming schedule suggestions' });
    expect(within(bell).queryByText('2')).toBeNull();

    await user.click(bell);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('No pending suggestions.')).toBeTruthy();
    expect(within(dialog).queryByTestId('invite-row-i1')).toBeNull();
  });
});