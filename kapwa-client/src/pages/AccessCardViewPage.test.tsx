import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { AccessCardViewPage } from './AccessCardViewPage';

const { mockApiGet, mockDownloadAccessCardPdf, mockUseAuth } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockDownloadAccessCardPdf: vi.fn(),
  mockUseAuth: vi.fn(),
}));

vi.mock('../lib/auth-context', () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
  },
  downloadAccessCardPdf: (...args: unknown[]) => mockDownloadAccessCardPdf(...args),
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
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue({ user: { id: '1', role: 'admin' }, loading: false });
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

  // Defect E: every control here but the agency select had a bare <label> with no
  // `htmlFor`, so clicking the text did nothing and assistive tech had no name to
  // announce. Reach each one by its label text.
  it('associates every add-entry control with its label', async () => {
    renderWithSWR(<AccessCardViewPage />);
    (await screen.findByRole('button', { name: /Add Entry/ })).click();

    expect((await screen.findByLabelText('Category')).tagName).toBe('SELECT');
    expect(((await screen.findByLabelText('Service Date *')) as HTMLInputElement).type).toBe('date');
    expect((await screen.findByLabelText('Service Rendered *')).tagName).toBe('INPUT');
    expect(((await screen.findByLabelText('Cost (₱)')) as HTMLInputElement).type).toBe('number');
    expect((await screen.findByLabelText('Worker Name')).tagName).toBe('INPUT');
  });

  it('offers the same sanctioned categories as the other logging forms', async () => {
    renderWithSWR(<AccessCardViewPage />);
    (await screen.findByRole('button', { name: /Add Entry/ })).click();

    const select = await screen.findByLabelText('Category');
    const offered = within(select).getAllByRole('option').map(o => (o as HTMLOptionElement).value);
    expect([...offered].sort()).toEqual(
      ['case_service', 'referral', 'community_service', 'seminar', 'payout', 'compliance'].sort(),
    );
  });
});

describe('AccessCardViewPage — access card PDF export', () => {
  it('downloads the access card PDF when the button is clicked', async () => {
    renderWithSWR(<AccessCardViewPage />);
    const btn = await screen.findByRole('button', { name: /access card \(pdf\)/i });
    btn.click();
    expect(mockDownloadAccessCardPdf).toHaveBeenCalledWith('ben1');
  });

  it('hides the access card PDF button from claimants', async () => {
    mockUseAuth.mockReturnValue({ user: { id: '1', role: 'claimant' }, loading: false });
    renderWithSWR(<AccessCardViewPage />);
    await screen.findByText('Services Rendered');
    expect(screen.queryByRole('button', { name: /access card \(pdf\)/i })).toBeNull();
  });
});
