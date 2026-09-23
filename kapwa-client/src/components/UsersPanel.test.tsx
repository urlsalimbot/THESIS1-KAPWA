import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import UsersPanel from './UsersPanel';

const { mockApiGet, mockApiPatch } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPatch: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
    patch: (...args: unknown[]) => mockApiPatch(...args),
  },
}));

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </SWRConfig>,
  );
}

const ACTIVE_RESPONSE = {
  data: [
    {
      id: 'u1', email: 'worker1@mswdo.test', fullName: 'Juan Dela Cruz',
      firstName: 'Juan', lastName: 'Dela Cruz', role: 'social_worker',
      assignedBarangay: 'Bigte', isActive: true, createdAt: '2026-01-01T00:00:00Z',
    },
  ],
  total: 1, page: 1, limit: 10,
};

const DISABLED_RESPONSE = {
  data: [
    {
      id: 'u2', email: 'disabled@mswdo.test', fullName: 'Disabled Person',
      firstName: 'Disabled', lastName: 'Person', role: 'coordinator',
      assignedBarangay: '', isActive: false, createdAt: '2026-01-02T00:00:00Z',
    },
  ],
  total: 1, page: 1, limit: 10,
};

describe('UsersPanel', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiPatch.mockReset();
    mockApiPatch.mockResolvedValue({});
    mockApiGet.mockImplementation((key: unknown) => {
      const k = String(key);
      if (k.includes('agencies')) {
        return Promise.resolve([{ id: 'ag-rhu', code: 'RHU', name: 'Rural Health Unit - Norzagaray' }]);
      }
      if (k.includes('status=inactive')) return Promise.resolve(DISABLED_RESPONSE);
      if (k.includes('users')) return Promise.resolve(ACTIVE_RESPONSE);
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('renders the paginated user table with fullName', async () => {
    renderWithSWR(<UsersPanel />);
    expect(await screen.findByText('worker1@mswdo.test')).toBeTruthy();
    expect(screen.getByText('Juan Dela Cruz')).toBeTruthy();
    expect(screen.getByText(/MSWDO Social Worker/)).toBeTruthy();
  });

  it('does not render the inline create-user form anymore', async () => {
    renderWithSWR(<UsersPanel />);
    await screen.findByText('worker1@mswdo.test');
    expect(screen.queryByText('Create New User')).toBeNull();
  });

  it('offers no delete control — only disable', async () => {
    renderWithSWR(<UsersPanel />);
    await screen.findByText('worker1@mswdo.test');
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
    expect(screen.getByRole('button', { name: 'Disable worker1@mswdo.test' })).toBeTruthy();
  });

  it('disables a user through PATCH /users/:id/disable after confirmation', async () => {
    const user = userEvent.setup();
    renderWithSWR(<UsersPanel />);
    await screen.findByText('worker1@mswdo.test');

    fireEvent.click(screen.getByRole('button', { name: 'Disable worker1@mswdo.test' }));
    await screen.findByText('Disable User?');
    await user.click(screen.getByRole('button', { name: 'Disable' }));

    await vi.waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith('/users/u1/disable');
    });
  });

  it('lists disabled users in a separate tab and enables them', async () => {
    const user = userEvent.setup();
    renderWithSWR(<UsersPanel />);
    await screen.findByText('worker1@mswdo.test');

    await user.click(screen.getByRole('tab', { name: 'Disabled users' }));
    expect(await screen.findByText('disabled@mswdo.test')).toBeTruthy();
    expect(screen.queryByText('worker1@mswdo.test')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Enable disabled@mswdo.test' }));
    await screen.findByText('Enable User?');
    await user.click(screen.getByRole('button', { name: 'Enable' }));

    await vi.waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith('/users/u2/enable');
    });
  });

  it('edit dialog pre-fills name parts and saves them via PATCH', async () => {
    const user = userEvent.setup();
    renderWithSWR(<UsersPanel />);
    await screen.findByText('worker1@mswdo.test');

    // fireEvent (not userEvent) opens the dialog: userEvent's pointer sequence
    // can be lost when SWR re-renders the row mid-click, which made this flaky.
    fireEvent.click(screen.getByRole('button', { name: 'Edit worker1@mswdo.test' }));
    await screen.findByRole('dialog', {}, { timeout: 10000 });
    expect(screen.getByDisplayValue('Juan')).toBeTruthy();
    expect(screen.getByDisplayValue('Dela Cruz')).toBeTruthy();

    await user.clear(screen.getByLabelText('First Name'));
    await user.type(screen.getByLabelText('First Name'), 'Juanito');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await vi.waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith(
        '/users/u1',
        expect.objectContaining({ firstName: 'Juanito', lastName: 'Dela Cruz', role: 'social_worker' }),
      );
    });
  });
});
