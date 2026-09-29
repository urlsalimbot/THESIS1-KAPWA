import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { TeamWorkspacePage } from './TeamWorkspacePage';
import { BlockEditorDialog } from '../components/team/BlockEditorDialog';
import { weekStart, addDays, localIsoDay } from '../components/team/team-utils';
import { formatDate } from '../lib/format';

const { mockApiGet, mockApiPut, mockApiPost, mockApiPatch, mockUser } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPut: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiPatch: vi.fn(),
  mockUser: { id: 'u1', role: 'admin', fullName: 'Ana Admin', email: 'ana@kapwa.ph' },
}));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    patch: (...args: unknown[]) => mockApiPatch(...args),
    del: vi.fn(),
  },
}));

vi.mock('../lib/auth-context', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('../hooks/useTeamStatus', () => ({
  useTeamStatus: vi.fn(),
}));

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </SWRConfig>,
  );
}

const PER_STAFF = [
  { userId: 'u1', name: 'Ana Admin', cases: 2, interventions: 1, referrals: 0, docs: 1, trackerDays: 2 },
  { userId: 'u2', name: 'Ben Social', cases: 0, interventions: 3, referrals: 1, docs: 0, trackerDays: 1 },
];

const STATUSES = [
  { userId: 'u1', status: 'in_office', note: null, updatedAt: '2026-09-28T01:00:00.000Z' },
  { userId: 'u2', status: 'field_day', note: 'Bgy. Bigte FDS', updatedAt: '2026-09-28T02:00:00.000Z' },
];

// One day block for Ana on the current week's Monday so block-click gating
// has something to click. Kept week-relative so tests never depend on a
// fixed calendar date.
const WEEK_FROM = localIsoDay(weekStart(new Date()));
const WEEK_TO = localIsoDay(addDays(weekStart(new Date()), 6));
const DAY_BLOCK = {
  id: 'b1',
  userId: 'u1',
  blockDate: WEEK_FROM,
  blockType: 'in_office',
  startTime: null,
  endTime: null,
  note: null,
};

// Repeating weekly event on the current week's Monday (09:00 Manila) with an
// ISO-instant until — the click-to-edit fixture. The dialog must prefill the
// Until input with the normalized Manila day ('2026-12-31') and keep the rule.
const WEEKLY_EVENT = {
  id: 'e1',
  title: 'Weekly sync',
  startsAt: `${WEEK_FROM}T01:00:00.000Z`,
  endsAt: `${WEEK_FROM}T02:00:00.000Z`,
  repeatRule: { freq: 'weekly', interval: 1, until: '2026-12-31T00:00:00.000Z' },
  visibleTo: 'staff',
};

/**
 * The schedule SWR hook must go through team-api.getSchedule, which merges
 * GET /team/blocks + GET /team/events (real string paths hitting api.get).
 * There is NO GET /team/schedule endpoint server-side, so the mock keys off
 * the string paths — if the page regressed to the global fetcher, the tuple
 * key ['team','schedule',...] would reach mockApiGet and nothing would
 * satisfy the blocks/events branches.
 */
function defaultMock() {
  mockApiGet.mockImplementation((key: unknown) => {
    const k = JSON.stringify(key);
    if (k.includes('/team/blocks')) return Promise.resolve([DAY_BLOCK]);
    if (k.includes('/team/events')) return Promise.resolve([WEEKLY_EVENT]);
    if (k.includes('achievements')) {
      return Promise.resolve({ perStaff: PER_STAFF, range: { from: WEEK_FROM, to: WEEK_TO } });
    }
    if (k.includes('statuses')) return Promise.resolve(STATUSES);
    if (k.includes('"status"')) return Promise.resolve(STATUSES[0]);
    return Promise.resolve(null);
  });
}

describe('TeamWorkspacePage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiPut.mockReset();
    mockApiPost.mockReset();
    mockApiPatch.mockReset();
    mockUser.role = 'admin';
    defaultMock();
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('renders the view switcher, the week label and the Today button', async () => {
    renderWithSWR(<TeamWorkspacePage />);

    for (const name of ['Week', 'Month', 'Agenda', 'Staff']) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
    expect(screen.getByRole('button', { name: /Today/i })).toBeTruthy();

    const from = weekStart(new Date());
    const label = `${formatDate(localIsoDay(from))} – ${formatDate(localIsoDay(addDays(from, 6)))}`;
    expect(await screen.findByText(label)).toBeTruthy();
  });

  it('disables the New block button until a slot is selected, then enables it', async () => {
    renderWithSWR(<TeamWorkspacePage />);

    const newBtn = screen.getByRole('button', { name: /^New block$/ });
    expect(newBtn).toBeDisabled();

    // Pick an empty slot in the week grid (Ana Admin, the first day).
    const slots = await screen.findAllByRole('button', {
      name: /New block for Ana Admin on/,
    });
    fireEvent.click(slots[0]);

    await waitFor(() => expect(newBtn).not.toBeDisabled());
  });

  it('fetches the week schedule through the client-side merge (blocks+events), never /team/schedule', async () => {
    renderWithSWR(<TeamWorkspacePage />);

    // getSchedule(from, to) → Promise.all(getBlocks, getEvents) → api.get with
    // the real string paths. A regression to the global fetcher would send the
    // ['team','schedule',…] tuple instead and these assertions would fail.
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(`/team/blocks?from=${WEEK_FROM}&to=${WEEK_TO}`);
      expect(mockApiGet).toHaveBeenCalledWith(`/team/events?from=${WEEK_FROM}&to=${WEEK_TO}`);
    });
    expect(mockApiGet).not.toHaveBeenCalledWith(expect.stringContaining('/team/schedule'));
  });

  it('renders staff chips in the status bar from the status board', async () => {
    renderWithSWR(<TeamWorkspacePage />);

    const bar = await screen.findByRole('region', { name: /team status/i });
    expect(within(bar).getByText('Ana Admin')).toBeTruthy();
    expect(within(bar).getByText('Ben Social')).toBeTruthy();
    expect(within(bar).getByText('In office')).toBeTruthy();
    expect(within(bar).getByText('Field day')).toBeTruthy();
  });

  it('Today returns to the current week after navigating', async () => {
    renderWithSWR(<TeamWorkspacePage />);

    fireEvent.click(screen.getByRole('button', { name: /Next week/i }));
    fireEvent.click(screen.getByRole('button', { name: /Today/i }));

    const from = weekStart(new Date());
    const label = `${formatDate(localIsoDay(from))} – ${formatDate(localIsoDay(addDays(from, 6)))}`;
    expect(await screen.findByText(label)).toBeTruthy();
  });

  it('status dropdown calls putStatus and revalidates the status keys', async () => {
    renderWithSWR(<TeamWorkspacePage />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: /Set my status/i }));
    const item = await screen.findByRole('menuitem', { name: /On leave/i });
    await user.click(item);

    await waitFor(() =>
      expect(mockApiPut).toHaveBeenCalledWith('/team/status', { status: 'on_leave', note: null }),
    );
  });

  it('opens the block editor from a grid block with Delete/Save for editors', async () => {
    renderWithSWR(<TeamWorkspacePage />);

    const blockBtn = await screen.findByRole('button', {
      name: new RegExp(`Ana Admin — In office on ${WEEK_FROM}`),
    });
    fireEvent.click(blockBtn);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: /Delete/i })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: /Save changes/i })).toBeTruthy();
  });

  it('coordinator is read-only: New/Event disabled, grid clicks open no editor', async () => {
    mockUser.role = 'coordinator';
    renderWithSWR(<TeamWorkspacePage />);

    expect(screen.getByRole('button', { name: /^New block$/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^New event$/ })).toBeDisabled();

    // Every empty-slot affordance is disabled, so clicks cannot open the dialog.
    const slots = await screen.findAllByRole('button', { name: /New block for Ana Admin on/ });
    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) expect(slot).toBeDisabled();
    fireEvent.click(slots[0]);
    expect(screen.queryByRole('dialog')).toBeNull();

    // Block bars are disabled too — no edit dialog for coordinators.
    const blockBtn = await screen.findByRole('button', {
      name: new RegExp(`Ana Admin — In office on ${WEEK_FROM}`),
    });
    expect(blockBtn).toBeDisabled();
    fireEvent.click(blockBtn);
    expect(screen.queryByRole('dialog')).toBeNull();

    // Event chips are disabled as well — coordinators cannot open the editor.
    const eventChip = await screen.findByRole('button', { name: 'Weekly sync' });
    expect(eventChip).toBeDisabled();
    fireEvent.click(eventChip);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('clicking an event chip opens the editor prefilled and saving patches the event', async () => {
    renderWithSWR(<TeamWorkspacePage />);
    const user = userEvent.setup();

    fireEvent.click(await screen.findByRole('button', { name: 'Weekly sync' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Edit event' })).toBeTruthy();
    expect(within(dialog).getByLabelText('Title')).toHaveValue('Weekly sync');
    expect(within(dialog).getByRole('checkbox', { name: 'Repeat weekly' })).toBeChecked();
    // ISO-instant until prefills as its Manila calendar day — the repeat rule
    // must survive the edit (until is only dropped by unchecking the box).
    expect(within(dialog).getByLabelText('Until')).toHaveValue('2026-12-31');

    await user.clear(within(dialog).getByLabelText('Title'));
    await user.type(within(dialog).getByLabelText('Title'), 'Weekly sync (edited)');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(mockApiPatch).toHaveBeenCalledWith(
        '/team/events/e1',
        expect.objectContaining({
          title: 'Weekly sync (edited)',
          repeatRule: { freq: 'weekly', interval: 1, until: '2026-12-31' },
        }),
      ),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('unchecking Repeat weekly sends repeatRule: null in the PATCH, removing the stored rule', async () => {
    renderWithSWR(<TeamWorkspacePage />);
    const user = userEvent.setup();

    fireEvent.click(await screen.findByRole('button', { name: 'Weekly sync' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('checkbox', { name: 'Repeat weekly' })).toBeChecked();

    await user.click(within(dialog).getByRole('checkbox', { name: 'Repeat weekly' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    // Server updateEvent only overwrites repeat_rule when the field is
    // present (`dto.repeatRule !== undefined`), so removal must be explicit
    // null — omitting it would leave the stored rule untouched.
    await waitFor(() =>
      expect(mockApiPatch).toHaveBeenCalledWith(
        '/team/events/e1',
        expect.objectContaining({ repeatRule: null }),
      ),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('BlockEditorDialog hides Save/Delete affordances when readOnly', async () => {
    render(
      <MemoryRouter>
        <BlockEditorDialog
          open
          onOpenChange={() => {}}
          staff={PER_STAFF}
          staffId="u1"
          date={WEEK_FROM}
          readOnly
          onSave={vi.fn()}
          onDelete={vi.fn()}
        />
      </MemoryRouter>,
    );

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('button', { name: /Create block/i })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: /Delete/i })).toBeNull();
    expect(within(dialog).getByRole('button', { name: /Cancel/i })).toBeTruthy();
  });

  it('clears the draft slot after creating a block, so New returns to disabled', async () => {
    renderWithSWR(<TeamWorkspacePage />);
    const user = userEvent.setup();

    // Slot click prefills the dialog (staffId + date come from the draft).
    const slot = await screen.findByRole('button', {
      name: new RegExp(`New block for Ana Admin on ${WEEK_FROM}`),
    });
    fireEvent.click(slot);

    const dialog = await screen.findByRole('dialog');

    // Create saves via the channel POST (not the nonexistent /team/schedule),
    // closes the dialog and clears the draft so New falls back to disabled.
    await user.click(within(dialog).getByRole('button', { name: /Create block/i }));

    await waitFor(() =>
      expect(mockApiPost).toHaveBeenCalledWith(
        '/team/blocks',
        expect.objectContaining({ userId: 'u1', blockDate: WEEK_FROM }),
      ),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(screen.getByRole('button', { name: /^New block$/ })).toBeDisabled());
  });
});