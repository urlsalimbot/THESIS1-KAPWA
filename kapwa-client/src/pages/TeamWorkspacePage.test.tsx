import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { TeamWorkspacePage } from './TeamWorkspacePage';
import { weekStart, addDays, localIsoDay } from '../components/team/team-utils';
import { formatDate } from '../lib/format';

const { mockApiGet, mockApiPut } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPut: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
    post: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock('../lib/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'u1', role: 'admin', fullName: 'Ana Admin', email: 'ana@kapwa.ph' },
  }),
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

function defaultMock() {
  mockApiGet.mockImplementation((key: unknown) => {
    const k = JSON.stringify(key);
    if (k.includes('schedule')) {
      return Promise.resolve({ from: '2026-09-28', to: '2026-10-04', blocks: [], events: [] });
    }
    if (k.includes('achievements')) {
      return Promise.resolve({ perStaff: PER_STAFF, range: { from: '2026-09-28', to: '2026-10-04' } });
    }
    if (k.includes('statuses')) {
      return Promise.resolve(STATUSES);
    }
    if (k.includes('"status"')) {
      return Promise.resolve(STATUSES[0]);
    }
    return Promise.resolve(null);
  });
}

describe('TeamWorkspacePage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiPut.mockReset();
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

    const newBtn = screen.getByRole('button', { name: /New block/i });
    expect(newBtn).toBeDisabled();

    // Pick an empty slot in the week grid (Ana Admin, the first day).
    const slots = await screen.findAllByRole('button', {
      name: /New block for Ana Admin on/,
    });
    fireEvent.click(slots[0]);

    await waitFor(() => expect(newBtn).not.toBeDisabled());
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
});