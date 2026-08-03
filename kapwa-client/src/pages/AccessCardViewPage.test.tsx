import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { AccessCardViewPage } from './AccessCardViewPage';

const { mockApiGet } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
  },
}));

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
      <MemoryRouter initialEntries={['/beneficiary/ben1/access-card']}>
        <Routes>
          <Route path="/beneficiary/:id/access-card" element={ui} />
        </Routes>
      </MemoryRouter>
    </SWRConfig>,
  );
}

describe('AccessCardViewPage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('access-cards') && k.includes('summary')) {
        return Promise.resolve({
          cardCode: 'NORZ-AC-2026-0001',
          person: { id: 'p1', firstName: 'Juan', surname: 'Dela Cruz' },
          servicesRendered: [{ id: 's1', agencyId: 'ag-1', agency: 'MSWDO' }],
          servicesFromOtherAgencies: [
            { id: 's2', agencyId: 'ag-2', agency: 'RHU', serviceRendered: 'Medical Consultation' },
          ],
          referralHistory: [
            {
              id: 'r1',
              fromAgencyId: 'ag-1',
              toAgencyId: 'ag-2',
              status: 'referred',
              reason: 'Medical follow-up',
              createdAt: '2026-08-01T00:00:00.000Z',
              fromAgency: { id: 'ag-1', code: 'MSWDO', name: 'Municipal Social Welfare and Development Office' },
              toAgency: { id: 'ag-2', code: 'RHU', name: 'Rural Health Unit - Norzagaray' },
            },
          ],
          sharingConsentActive: true,
        });
      }
      if (k.includes('beneficiaries') && k.includes('ben1')) {
        return Promise.resolve({ firstName: 'Juan', surname: 'Dela Cruz', gender: 'Male', address: 'Norzagaray' });
      }
      if (k.includes('family-graph')) {
        return Promise.resolve({ members: [] });
      }
      if (k.includes('access-cards') && k.includes('beneficiary')) {
        return Promise.resolve({
          beneficiary: { first_name: 'Juan', surname: 'Dela Cruz' },
          code: 'NORZ-AC-2026-0001',
          services: [
            { id: 's1', accessCardCode: 'NORZ-AC-2026-0001', serviceDate: '2026-07-01', serviceRendered: 'Financial Assistance', agency: 'MSWDO', category: 'case_service' },
          ],
        });
      }
      if (k.includes('agencies')) {
        return Promise.resolve([
          { id: 'ag-1', code: 'MSWDO', name: 'Municipal Social Welfare and Development Office' },
          { id: 'ag-2', code: 'RHU', name: 'Rural Health Unit - Norzagaray' },
        ]);
      }
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('renders the Services Rendered section', async () => {
    renderWithSWR(<AccessCardViewPage />);
    expect(await screen.findByRole('heading', { name: /Access Card/ })).toBeTruthy();
    expect(screen.getByText('Services Rendered')).toBeTruthy();
  });

  it('renders Services From Other Agencies and Referrals History from the summary', async () => {
    renderWithSWR(<AccessCardViewPage />);
    expect(await screen.findByText('Services From Other Agencies')).toBeTruthy();
    expect(screen.getByText('Medical Consultation')).toBeTruthy();
    expect(await screen.findByText('Referrals History')).toBeTruthy();
    expect(screen.getByText('Medical follow-up')).toBeTruthy();
  });

  it('shows an agency select in the add-entry form', async () => {
    renderWithSWR(<AccessCardViewPage />);
    const addEntryButton = await screen.findByRole('button', { name: /Add Entry/ });
    // jsdom does not implement showModal; click is enough to open the form markup below.
    addEntryButton.click();
    expect(await screen.findByLabelText('Agency *')).toBeTruthy();
  });
});
