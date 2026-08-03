import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import UsersPanel from './UsersPanel';

const { mockApiGet, mockApiPost } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: { get: (...args: unknown[]) => mockApiGet(...args), post: (...args: unknown[]) => mockApiPost(...args), put: vi.fn(), del: vi.fn(), patch: vi.fn() },
}));

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </SWRConfig>,
  );
}

async function openCreateForm() {
  const user = userEvent.setup();
  renderWithSWR(<UsersPanel />);
  await screen.findByText('Create New User');
  await user.click(screen.getByRole('button', { name: 'New User' }));
  await screen.findByLabelText('Email *');
  return user;
}

describe('UsersPanel create dialog', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('agencies')) {
        return Promise.resolve([
          { id: 'ag-rhu', code: 'RHU', name: 'Rural Health Unit - Norzagaray' },
        ]);
      }
      if (k.includes('users')) {
        return Promise.resolve({ data: [], total: 0, page: 1, limit: 20 });
      }
      return Promise.resolve(null);
    });
    mockApiPost.mockResolvedValue({ user: { email: 'staff@agency.test' } });
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('reveals the agency select when role agency_staff is selected', async () => {
    const user = await openCreateForm();
    await user.click(screen.getByRole('combobox', { name: 'Role *' }));
    await user.click(await screen.findByRole('option', { name: 'Agency Staff' }));
    expect(await screen.findByLabelText('Agency *')).toBeTruthy();
  });

  it('blocks submitting an agency_staff user without an agency', async () => {
    const user = await openCreateForm();
    await user.click(screen.getByRole('combobox', { name: 'Role *' }));
    await user.click(await screen.findByRole('option', { name: 'Agency Staff' }));
    await screen.findByLabelText('Agency *');
    expect(screen.getByRole('button', { name: 'Create User' })).toBeDisabled();
  });

  it('posts agency_id when an agency is selected', async () => {
    const user = await openCreateForm();
    await user.click(screen.getByRole('combobox', { name: 'Role *' }));
    await user.click(await screen.findByRole('option', { name: 'Agency Staff' }));
    await user.click(screen.getByRole('combobox', { name: 'Agency *' }));
    await user.click(await screen.findByRole('option', { name: /RHU/ }));

    await user.type(screen.getByLabelText('Email *'), 'staff@agency.test');
    await user.type(screen.getByLabelText('Password *'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Create User' }));

    await vi.waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/users',
        expect.objectContaining({ role: 'agency_staff', agency_id: 'ag-rhu' }),
      );
    });
  });
});
