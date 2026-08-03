import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { AgencyCardActivitiesPage } from './AgencyCardActivitiesPage';

const { mockApiGet, mockApiPost } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: { get: (...args: unknown[]) => mockApiGet(...args), post: (...args: unknown[]) => mockApiPost(...args), patch: vi.fn(), put: vi.fn(), del: vi.fn() },
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

describe('AgencyCardActivitiesPage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('agencies')) {
        return Promise.resolve([{ id: 'ag-rhu', code: 'RHU', name: 'Rural Health Unit' }]);
      }
      if (k.includes('access-cards') && k.includes('summary')) {
        return Promise.resolve({ person: { id: 'p1', firstName: 'Juan', surname: 'Santos' } });
      }
      if (k.includes('access-cards')) {
        return Promise.resolve([
          { id: 's1', serviceRendered: 'Medical Consultation', serviceDate: '2026-07-20', category: 'referral' },
        ]);
      }
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('verifies a card and shows service history', async () => {
    const user = userEvent.setup();
    renderWithSWR(<AgencyCardActivitiesPage />);
    await user.type(screen.getByPlaceholderText(/Enter card code/), 'NORZ-AC-2026-0042');
    await user.click(screen.getByRole('button', { name: /Verify/ }));
    expect(await screen.findByText('Medical Consultation')).toBeTruthy();
    expect(screen.getByText('Juan Santos')).toBeTruthy();
  });

  it('logs an activity with the pre-selected agency', async () => {
    const user = userEvent.setup();
    renderWithSWR(<AgencyCardActivitiesPage />);
    await user.type(screen.getByPlaceholderText(/Enter card code/), 'NORZ-AC-2026-0042');
    await user.click(screen.getByRole('button', { name: /Verify/ }));
    await user.type(await screen.findByPlaceholderText(/Describe the activity/), 'Dental checkup');
    await user.click(screen.getByRole('button', { name: 'Log Activity' }));
    expect(mockApiPost).toHaveBeenCalledWith('/access-cards/log', expect.objectContaining({
      accessCardCode: 'NORZ-AC-2026-0042',
      serviceRendered: 'Dental checkup',
      agencyId: 'ag-rhu',
    }));
  });
});
