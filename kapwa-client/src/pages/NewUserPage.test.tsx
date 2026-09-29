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
    expect(screen.queryByLabelText('Password *')).toBeNull();
  });
});