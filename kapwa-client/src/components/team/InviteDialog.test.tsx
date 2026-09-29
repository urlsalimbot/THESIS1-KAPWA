import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InviteDialog } from './InviteDialog';
import type { TeamStaffAchievement } from '../../lib/team-api';

const STAFF: TeamStaffAchievement[] = [
  { userId: 'u1', name: 'Ana Admin', cases: 2, interventions: 1, referrals: 0, docs: 1, trackerDays: 2 },
  { userId: 'u2', name: 'Ben Social', cases: 0, interventions: 3, referrals: 1, docs: 0, trackerDays: 1 },
];

function renderDialog(
  overrides: Partial<React.ComponentProps<typeof InviteDialog>> = {},
): { onSend: ReturnType<typeof vi.fn> } {
  const onSend = vi.fn();
  render(
    <InviteDialog open onOpenChange={() => {}} staff={STAFF} myUserId="u1" onSend={onSend} {...overrides} />,
  );
  return { onSend };
}

describe('InviteDialog (Suggest a schedule)', () => {
  it('prefills the staff member and date from the clicked colleague slot', async () => {
    renderDialog({ staffId: 'u2', date: '2026-09-30' });

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Suggest a schedule' })).toBeTruthy();
    expect(within(dialog).getByRole('combobox', { name: 'Staff member' })).toHaveTextContent('Ben Social');
    expect(within(dialog).getByLabelText('Date')).toHaveValue('2026-09-30');
  });

  it('send emits the suggestion input (default block type, note omitted when blank)', async () => {
    const { onSend } = renderDialog({ staffId: 'u2', date: '2026-09-30' });
    const user = userEvent.setup();

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Send suggestion' }));

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith({
      toUserId: 'u2',
      inviteDate: '2026-09-30',
      blockType: 'in_office',
    });
  });

  it('includes the note and picked type when provided', async () => {
    const { onSend } = renderDialog({ staffId: 'u2', date: '2026-09-30' });
    const user = userEvent.setup();

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('combobox', { name: 'Type' }));
    await user.click(await screen.findByRole('option', { name: 'Home visit' }));
    await user.type(within(dialog).getByLabelText('Note'), 'Kickoff meeting');
    await user.click(within(dialog).getByRole('button', { name: 'Send suggestion' }));

    expect(onSend).toHaveBeenCalledWith({
      toUserId: 'u2',
      inviteDate: '2026-09-30',
      blockType: 'home_visit',
      note: 'Kickoff meeting',
    });
  });

  it('excludes the signed-in user from the target list (no self-invites)', async () => {
    renderDialog();

    const dialog = await screen.findByRole('dialog');
    await userEvent.setup().click(within(dialog).getByRole('combobox', { name: 'Staff member' }));
    const options = await screen.findAllByRole('option');
    const names = options.map(option => option.textContent ?? '');
    expect(names).toContain('Ben Social');
    expect(names).not.toContain('Ana Admin');
  });

  it('send is disabled until staff and date are chosen', async () => {
    renderDialog();

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Send suggestion' })).toBeDisabled();
  });
});