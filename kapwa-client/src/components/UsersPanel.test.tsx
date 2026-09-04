import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import UsersPanel from './UsersPanel';

const { mockApiGet, mockApiPut } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPut: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: { get: (...args: unknown[]) => mockApiGet(...args), post: vi.fn(), put: (...args: unknown[]) => mockApiPut(...args), del: vi.fn(), patch: vi.fn() },
}));

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </SWRConfig>,
  );
}

const USERS_RESPONSE = {
  data: [
    {
      id: 'u1', email: 'worker1@mswdo.test', fullName: 'Juan Dela Cruz',
      firstName: 'Juan', lastName: 'Dela Cruz', role: 'social_worker',
      assignedBarangay: 'Bigte', isActive: true, createdAt: '2026-01-01T00:00:00Z',
    },
  ],
  total: 1, page: 1, limit: 20,
};

describe('UsersPanel', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiPut.mockReset();
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('agencies')) {
        return Promise.resolve([{ id: 'ag-rhu', code: 'RHU', name: 'Rural Health Unit - Norzagaray' }]);
      }
      if (k.includes('users')) {
        return Promise.resolve(USERS_RESPONSE);
      }
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

  it('edit dialog pre-fills name parts and saves them via PATCH', async () => {
    const user = userEvent.setup();
    renderWithSWR(<UsersPanel />);
    await screen.findByText('worker1@mswdo.test');

    await user.click(screen.getByRole('button', { name: 'Edit worker1@mswdo.test' }));
    expect(await screen.findByDisplayValue('Juan')).toBeTruthy();
    expect(screen.getByDisplayValue('Dela Cruz')).toBeTruthy();

    await user.clear(screen.getByLabelText('First Name'));
    await user.type(screen.getByLabelText('First Name'), 'Juanito');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await vi.waitFor(() => {
      expect(mockApiPut).toHaveBeenCalledWith(
        '/users/u1',
        expect.objectContaining({ firstName: 'Juanito', lastName: 'Dela Cruz', role: 'social_worker' }),
      );
    });
  });
});