import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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

  const SANCTIONED = ['case_service', 'referral', 'community_service', 'seminar', 'payout', 'compliance'];

  async function verifyACard() {
    const user = userEvent.setup();
    renderWithSWR(<AgencyCardActivitiesPage />);
    await user.type(screen.getByPlaceholderText(/Enter card code/), 'NORZ-AC-2026-0042');
    await user.click(screen.getByRole('button', { name: /Verify/ }));
    await screen.findByPlaceholderText(/Describe the activity/);
    return user;
  }

  function offeredCategories() {
    const select = screen.getByLabelText(/^category/i);
    return within(select).getAllByRole('option').map(o => (o as HTMLOptionElement).value);
  }

  // Same regression as the coordinator form: 'distribution' and 'other' were offered
  // here too, and the server rejects both.
  it('offers no category the logging endpoint rejects', async () => {
    await verifyACard();
    expect(offeredCategories().filter(v => !SANCTIONED.includes(v))).toEqual([]);
  });

  it('offers payout and compliance alongside the other categories', async () => {
    await verifyACard();
    expect([...offeredCategories()].sort()).toEqual([...SANCTIONED].sort());
  });

  // Defect E: bare <label> with no htmlFor, so clicking the text did nothing and a
  // screen reader announced the fields unlabelled.
  it('associates every logging control with its label', async () => {
    await verifyACard();
    expect(screen.getByLabelText(/^category/i).tagName).toBe('SELECT');
    expect((screen.getByLabelText(/^date/i) as HTMLInputElement).type).toBe('date');
    expect((screen.getByLabelText(/^agency/i) as HTMLInputElement).tagName).toBe('SELECT');
    expect(screen.getByLabelText(/^remarks/i).tagName).toBe('TEXTAREA');
  });

  it('labels a service row in words, not in the stored category token', async () => {
    // An agency staffer saw the literal string `community_service` here while
    // the resident's own card called the same row "Community Service".
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
          {
            id: 's1',
            serviceRendered: 'Medical Consultation',
            serviceDate: '2026-07-20',
            category: 'community_service',
          },
        ]);
      }
      return Promise.resolve(null);
    });

    const user = userEvent.setup();
    renderWithSWR(<AgencyCardActivitiesPage />);
    await user.type(screen.getByPlaceholderText(/Enter card code/), 'NORZ-AC-2026-0042');
    await user.click(screen.getByRole('button', { name: /Verify/ }));
    await screen.findByText('Medical Consultation');

    // Scoped to the service row: the logging form's category dropdown also
    // reads "Community Service", so an unscoped query finds two of them.
    const row = screen.getByText('Medical Consultation').closest('div') as HTMLElement;
    expect(within(row).getByText('Community Service')).toBeTruthy();
    expect(screen.queryByText('community_service')).toBeNull();
    expect(within(row).getByText('Jul 20, 2026')).toBeTruthy();
    expect(screen.queryByText('2026-07-20')).toBeNull();
  });
});
