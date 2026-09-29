import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventEditorDialog } from './EventEditorDialog';
import { manilaDay } from './team-utils';
import type { TeamEvent } from '../../lib/team-api';

const EVENT: TeamEvent = {
  id: 'e1',
  title: 'Weekly team meeting',
  startsAt: '2026-10-05T01:00:00.000Z',
  endsAt: '2026-10-05T02:00:00.000Z',
  repeatRule: { freq: 'weekly', interval: 2, until: '2026-12-28' },
  visibleTo: 'staff_coordinators',
  location: 'MSWDO conference room',
  notes: 'Bring agenda',
};

function renderDialog(
  overrides: Partial<React.ComponentProps<typeof EventEditorDialog>> = {},
): {
  onSave: ReturnType<typeof vi.fn>;
  onDelete: ReturnType<typeof vi.fn>;
  onOpenChange: ReturnType<typeof vi.fn>;
} {
  const onSave = vi.fn();
  const onDelete = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <EventEditorDialog
      open
      onOpenChange={onOpenChange}
      onSave={onSave}
      onDelete={onDelete}
      {...overrides}
    />,
  );
  return { onSave, onDelete, onOpenChange };
}

describe('EventEditorDialog', () => {
  it('create mode saves repeat rule (weekly + interval + until) and visibility in the payload', async () => {
    const { onSave } = renderDialog();
    const user = userEvent.setup();

    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Title'), 'Weekly team meeting');
    fireEvent.change(within(dialog).getByLabelText('Starts'), {
      target: { value: '2026-10-05T09:00' },
    });
    fireEvent.change(within(dialog).getByLabelText('Ends'), {
      target: { value: '2026-10-05T10:00' },
    });

    await user.click(within(dialog).getByRole('checkbox', { name: 'Repeat weekly' }));
    fireEvent.change(within(dialog).getByLabelText('Repeat interval in weeks'), {
      target: { value: '2' },
    });
    fireEvent.change(within(dialog).getByLabelText('Until'), {
      target: { value: '2026-12-31' },
    });

    // Visibility: default 'staff'; pick 'staff_coordinators'.
    await user.click(within(dialog).getByRole('combobox', { name: 'Visible to' }));
    await user.click(await screen.findByRole('option', { name: 'Staff + coordinators' }));

    await user.click(within(dialog).getByRole('button', { name: 'Create event' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({
      title: 'Weekly team meeting',
      startsAt: new Date('2026-10-05T09:00').toISOString(),
      endsAt: new Date('2026-10-05T10:00').toISOString(),
      repeatRule: { freq: 'weekly', interval: 2, until: '2026-12-31' },
      visibleTo: 'staff_coordinators',
    });
  });

  it('edit mode prefills the event (repeat rule + visibility) and round-trips them on save', async () => {
    const { onSave } = renderDialog({ event: EVENT });
    const user = userEvent.setup();

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Edit event' })).toBeTruthy();
    expect(within(dialog).getByLabelText('Title')).toHaveValue('Weekly team meeting');
    expect(within(dialog).getByRole('checkbox', { name: 'Repeat weekly' })).toBeChecked();
    expect(within(dialog).getByLabelText('Repeat interval in weeks')).toHaveValue(2);
    expect(within(dialog).getByLabelText('Until')).toHaveValue('2026-12-28');
    expect(within(dialog).getByRole('combobox', { name: 'Visible to' })).toHaveTextContent(
      'Staff + coordinators',
    );
    expect(within(dialog).getByLabelText('Location')).toHaveValue('MSWDO conference room');
    expect(within(dialog).getByLabelText('Notes')).toHaveValue('Bring agenda');

    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({
      title: 'Weekly team meeting',
      startsAt: EVENT.startsAt,
      endsAt: EVENT.endsAt,
      repeatRule: { freq: 'weekly', interval: 2, until: '2026-12-28' },
      visibleTo: 'staff_coordinators',
      location: 'MSWDO conference room',
      notes: 'Bring agenda',
    });
  });

  it('delete asks for confirmation before calling onDelete (cancel path too)', async () => {
    const { onDelete } = renderDialog({ event: EVENT });
    const user = userEvent.setup();

    const dialog = await screen.findByRole('dialog');

    // Cancel first — onDelete must not fire.
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: /Cancel/i }));
    expect(onDelete).not.toHaveBeenCalled();

    // Then confirm — onDelete fires with the event id.
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    const confirm2 = await screen.findByRole('alertdialog');
    await user.click(within(confirm2).getByRole('button', { name: /^Delete$/ }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith('e1');
  });

  it('readOnly hides the Save and Delete affordances (coordinator mode)', async () => {
    renderDialog({ readOnly: true, event: EVENT });

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('button', { name: /Create event|Save changes/i })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: /Delete/i })).toBeNull();
    expect(within(dialog).getByRole('button', { name: /Cancel/i })).toBeTruthy();
  });

  it('cancel closes the dialog without save or delete calls', async () => {
    const { onSave, onDelete, onOpenChange } = renderDialog();
    const user = userEvent.setup();

    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Title'), 'Draft title');
    await user.click(within(dialog).getByRole('button', { name: /Cancel/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSave).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('edit mode normalizes an ISO-instant until to date-only and keeps the repeat rule on save', async () => {
    // Server stores repeatRule jsonb verbatim; an ISO-instant until (the
    // server's own spec fixture uses '2026-12-31T00:00:00Z') must prefill the
    // date input as its Manila calendar day and survive the save untouched.
    const isoRuleEvent: TeamEvent = {
      ...EVENT,
      repeatRule: { freq: 'weekly', interval: 2, until: '2026-12-28T16:00:00.000Z' },
    };
    const { onSave } = renderDialog({ event: isoRuleEvent });
    const user = userEvent.setup();

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('checkbox', { name: 'Repeat weekly' })).toBeChecked();
    expect(within(dialog).getByLabelText('Until')).toHaveValue(
      manilaDay(new Date('2026-12-28T16:00:00.000Z')),
    );

    // Edit a field and save — the repeat rule (with normalized until) survives.
    await user.clear(within(dialog).getByLabelText('Title'));
    await user.type(within(dialog).getByLabelText('Title'), 'Weekly sync (revised)');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Weekly sync (revised)',
        repeatRule: {
          freq: 'weekly',
          interval: 2,
          until: manilaDay(new Date('2026-12-28T16:00:00.000Z')),
        },
      }),
    );
  });

  it('unchecking Repeat weekly drops the rule from the saved payload (edit mode)', async () => {
    const { onSave } = renderDialog({ event: EVENT });
    const user = userEvent.setup();

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('checkbox', { name: 'Repeat weekly' })).toBeChecked();

    await user.click(within(dialog).getByRole('checkbox', { name: 'Repeat weekly' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(expect.not.objectContaining({ repeatRule: expect.anything() }));
  });
});