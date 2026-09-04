import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { NewUserPage } from './NewUserPage';

const { mockApiGet, mockApiPost } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: { get: (...args: unknown[]) => mockApiGet(...args), post: (...args: unknown[]) => mockApiPost(...args), put: vi.fn(), del: vi.fn(), patch: vi.fn() },
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => vi.fn() };
});

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter initialEntries={['/admin/users/new']}>{ui}</MemoryRouter>
    </SWRConfig>,
  );
}

describe('NewUserPage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('agencies')) {
        return Promise.resolve([{ id: 'ag-rhu', code: 'RHU', name: 'Rural Health Unit - Norzagaray' }]);
      }
      return Promise.resolve(null);
    });
    mockApiPost.mockResolvedValue({ user: { email: 'staff@agency.test' } });
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('renders the 3NF name-part fields', async () => {
    renderWithSWR(<NewUserPage />);
    expect(await screen.findByLabelText('First Name *')).toBeTruthy();
    expect(screen.getByLabelText('Middle Name')).toBeTruthy();
    expect(screen.getByLabelText('Last Name *')).toBeTruthy();
    expect(screen.getByLabelText('Name Extension')).toBeTruthy();
    expect(screen.getByLabelText('Email *')).toBeTruthy();
    expect(screen.getByLabelText('Password *')).toBeTruthy();
  });

  it('reveals the agency select when role agency_staff is selected', async () => {
    const user = userEvent.setup();
    renderWithSWR(<NewUserPage />);
    await user.click(await screen.findByRole('combobox', { name: 'Role' }));
    await user.click(await screen.findByRole('option', { name: 'Agency Staff' }));
    expect(await screen.findByRole('combobox', { name: 'Agency' })).toBeTruthy();
  });

  it('posts name parts + agency_id for an agency_staff user', async () => {
    const user = userEvent.setup();
    renderWithSWR(<NewUserPage />);

    await user.type(screen.getByLabelText('First Name *'), 'Jane');
    await user.type(screen.getByLabelText('Middle Name'), 'Marie');
    await user.type(screen.getByLabelText('Last Name *'), 'Dela Cruz');
    await user.type(screen.getByLabelText('Name Extension'), 'Jr.');
    await user.type(screen.getByLabelText('Email *'), 'staff@agency.test');
    await user.type(screen.getByLabelText('Password *'), 'password123');

    await user.click(screen.getByRole('combobox', { name: 'Role' }));
    await user.click(await screen.findByRole('option', { name: 'Agency Staff' }));
    await user.click(screen.getByRole('combobox', { name: 'Agency' }));
    await user.click(await screen.findByRole('option', { name: /RHU/ }));

    await user.click(screen.getByRole('button', { name: 'Create User' }));

    await vi.waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/users',
        expect.objectContaining({
          first_name: 'Jane',
          middle_name: 'Marie',
          last_name: 'Dela Cruz',
          name_extension: 'Jr.',
          role: 'agency_staff',
          agency_id: 'ag-rhu',
        }),
      );
    });
  });
});