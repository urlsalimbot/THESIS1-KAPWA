import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { AgencyProfilePage } from './AgencyProfilePage';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));

vi.mock('../lib/api', () => ({
  api: { get: (...args: unknown[]) => mockApiGet(...args), post: vi.fn(), patch: vi.fn(), put: vi.fn(), del: vi.fn() },
}));

vi.mock('../lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'u1', role: 'agency_staff', agencyId: 'ag-rhu' } }),
}));

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </SWRConfig>,
  );
}

describe('AgencyProfilePage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiGet.mockImplementation((key: unknown) => {
      if (JSON.stringify(key).includes('agency-portal')) {
        return Promise.resolve({ id: 'ag-rhu', code: 'RHU', name: 'Rural Health Unit - Norzagaray', type: 'health' });
      }
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('renders agency info', async () => {
    renderWithSWR(<AgencyProfilePage />);
    expect(await screen.findByRole('heading', { name: 'Rural Health Unit - Norzagaray' })).toBeTruthy();
    expect(screen.getByText('RHU')).toBeTruthy();
    expect(screen.getByText('health')).toBeTruthy();
  });
});
