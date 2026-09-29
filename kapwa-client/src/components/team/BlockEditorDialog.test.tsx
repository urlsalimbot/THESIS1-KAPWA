import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BlockEditorDialog } from './BlockEditorDialog';
import type { TeamBlock, TeamStaffAchievement } from '../../lib/team-api';

const STAFF: TeamStaffAchievement[] = [
  { userId: 'u1', name: 'Ana Admin', cases: 2, interventions: 1, referrals: 0, docs: 1, trackerDays: 2 },
  { userId: 'u2', name: 'Ben Social', cases: 0, interventions: 3, referrals: 1, docs: 0, trackerDays: 1 },
];

const BLOCK: TeamBlock = {
  id: 'b1',
  userId: 'u1',
  blockDate: '2026-09-28',
  blockType: 'home_visit',
  startTime: '09:00',
  endTime: '12:00',
  note: 'Intake',
  visibleTo: 'team_coordinators',
};

function renderDialog(
  overrides: Partial<React.ComponentProps<typeof BlockEditorDialog>> = {},
): { onSave: ReturnType<typeof vi.fn>; onDelete: ReturnType<typeof vi.fn> } {
  const onSave = vi.fn();
  const onDelete = vi.fn();
  render(
    <BlockEditorDialog
      open
      onOpenChange={() => {}}
      staff={STAFF}
      onSave={onSave}
      onDelete={onDelete}
      {...overrides}
    />,
  );
  return { onSave, onDelete };
}

describe('BlockEditorDialog', () => {
  it('prefills the staff and dates from the clicked slot in create mode', async () => {
    renderDialog({ staffId: 'u2', date: '2026-09-29' });

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('combobox', { name: 'Staff' })).toHaveTextContent('Ben Social');
    expect(within(dialog).getByLabelText('Start date')).toHaveValue('2026-09-29');
  });

  it('defaults the end date to the start date in create mode', async () => {
    renderDialog({ staffId: 'u2', date: '2026-09-29' });

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('End date')).toHaveValue('2026-09-29');
  });

  it('save emits the prefilled create input (the page then posts + revalidates)', async () => {
    const { onSave } = renderDialog({ staffId: 'u2', date: '2026-09-29' });
    const user = userEvent.setup();

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Create block' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({
      userId: 'u2',
      blockDate: '2026-09-29',
      endDate: null, // same-day → single-day block
      blockType: 'in_office',
      visibleTo: 'team', // amendment default: team-wide unless toggled
    });
  });

  it('a later end date is sent as the block endDate', async () => {
    const { onSave } = renderDialog({ staffId: 'u2', date: '2026-09-29' });
    const user = userEvent.setup();

    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('End date'), {
      target: { value: '2026-10-02' },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Create block' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        blockDate: '2026-09-29',
        endDate: '2026-10-02',
      }),
    );
  });

  it('moving the start date glues the untouched end date to it', async () => {
    const { onSave } = renderDialog({ staffId: 'u2', date: '2026-09-29' });
    const user = userEvent.setup();

    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Start date'), {
      target: { value: '2026-09-30' },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Create block' }));

    // End followed the start → still same-day → endDate null.
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ blockDate: '2026-09-30', endDate: null }),
    );
  });

  it('edit mode prefills the block and emits the same shape on save', async () => {
    const { onSave } = renderDialog({ block: BLOCK });
    const user = userEvent.setup();

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Edit block' })).toBeTruthy();
    expect(within(dialog).getByRole('combobox', { name: 'Staff' })).toHaveTextContent('Ana Admin');
    expect(within(dialog).getByLabelText('Start date')).toHaveValue('2026-09-28');
    expect(within(dialog).getByLabelText('End date')).toHaveValue('2026-09-28'); // single-day round-trip
    expect(within(dialog).getByLabelText('Start time')).toHaveValue('09:00');
    expect(within(dialog).getByLabelText('End time')).toHaveValue('12:00');
    expect(within(dialog).getByLabelText('Note')).toHaveValue('Intake');
    // Visibility round-trips: the stored toggle prefills the select.
    expect(within(dialog).getByRole('combobox', { name: 'Visible to' })).toHaveTextContent(
      'Team + coordinators',
    );

    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(onSave).toHaveBeenCalledWith({
      userId: 'u1',
      blockDate: '2026-09-28',
      endDate: null, // same-day block stays single-day
      blockType: 'home_visit',
      visibleTo: 'team_coordinators',
      startTime: '09:00',
      endTime: '12:00',
      note: 'Intake',
    });
  });

  it('edit mode restores a stored endDate (multi-day round-trip)', async () => {
    const multiDay: TeamBlock = { ...BLOCK, id: 'b2', endDate: '2026-09-30' };
    const { onSave } = renderDialog({ block: multiDay });
    const user = userEvent.setup();

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('End date')).toHaveValue('2026-09-30');

    // Saving without touching the dates keeps the range.
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        blockDate: '2026-09-28',
        endDate: '2026-09-30',
      }),
    );

    // Collapsing the end back onto the start clears the range again.
    fireEvent.change(within(dialog).getByLabelText('End date'), {
      target: { value: '2026-09-28' },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({ blockDate: '2026-09-28', endDate: null }),
    );
  });

  it('toggling visibility in create mode sends visibleTo: team_coordinators', async () => {
    const { onSave } = renderDialog({ staffId: 'u2', date: '2026-09-29' });
    const user = userEvent.setup();

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('combobox', { name: 'Visible to' }));
    await user.click(await screen.findByRole('option', { name: 'Team + coordinators' }));
    await user.click(within(dialog).getByRole('button', { name: 'Create block' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ visibleTo: 'team_coordinators' }),
    );
  });

  it('delete asks for confirmation before calling onDelete (cancel path too)', async () => {
    const { onDelete } = renderDialog({ block: BLOCK });
    const user = userEvent.setup();

    const dialog = await screen.findByRole('dialog');

    // Cancel first — onDelete must not fire.
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: /Cancel/i }));
    expect(onDelete).not.toHaveBeenCalled();

    // Then confirm — onDelete fires with the block id.
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    const confirm2 = await screen.findByRole('alertdialog');
    await user.click(within(confirm2).getByRole('button', { name: /^Delete$/ }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith('b1');
  });

  it('readOnly hides the Save and Delete affordances', async () => {
    renderDialog({ readOnly: true, block: BLOCK });

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('button', { name: /Create block|Save changes/i })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: /Delete/i })).toBeNull();
    expect(within(dialog).getByRole('button', { name: /Cancel/i })).toBeTruthy();
  });
});