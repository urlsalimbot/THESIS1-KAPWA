import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { InterAgencyReferralsPage } from './InterAgencyReferralsPage';

const { mockApiGet, mockApiPatch, mockApiPost } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPatch: vi.fn(),
  mockApiPost: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    patch: (...args: unknown[]) => mockApiPatch(...args),
    put: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock('../lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'u1', role: 'social_worker', agencyId: 'ag-1' } }),
}));

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </SWRConfig>,
  );
}

describe('InterAgencyReferralsPage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiPatch.mockReset();
    mockApiPost.mockReset();
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('inter-agency-referrals')) {
        return Promise.resolve([
          {
            id: 'r1',
            personId: 'p1',
            fromAgencyId: 'ag-2',
            toAgencyId: 'ag-1',
            status: 'referred',
            reason: 'Medical follow-up needed',
            legalBasisCode: 'public_authority_sec13',
            createdAt: '2026-08-01T00:00:00.000Z',
            fromAgency: { id: 'ag-2', code: 'RHU', name: 'Rural Health Unit - Norzagaray' },
            toAgency: { id: 'ag-1', code: 'MSWDO', name: 'Municipal Social Welfare and Development Office' },
            person: { id: 'p1', firstName: 'Juan', surname: 'Dela Cruz' },
          },
        ]);
      }
      if (k.includes('agencies')) {
        return Promise.resolve([
          { id: 'ag-1', code: 'MSWDO', name: 'Municipal Social Welfare and Development Office' },
          { id: 'ag-2', code: 'RHU', name: 'Rural Health Unit - Norzagaray' },
        ]);
      }
      if (k.includes('beneficiaries')) {
        return Promise.resolve({ data: [{ id: 'ben1', firstName: 'Juan', surname: 'Dela Cruz', address: 'Brgy. Centro, Norzagaray' }], total: 1 });
      }
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('renders the page heading and a referral card', async () => {
    renderWithSWR(<InterAgencyReferralsPage />);
    expect(await screen.findByRole('heading', { name: 'Inter-Agency Referrals' })).toBeTruthy();
    expect(await screen.findByText('Juan Dela Cruz')).toBeTruthy();
    expect(screen.getByText('Referred')).toBeTruthy();
  });

  it('calls receive transition for the receiving agency', async () => {
    const user = userEvent.setup();
    renderWithSWR(<InterAgencyReferralsPage />);
    const receiveButton = await screen.findByRole('button', { name: 'Receive' });
    await user.click(receiveButton);
    expect(mockApiPatch).toHaveBeenCalledWith('/inter-agency-referrals/r1/receive', undefined);
  });

  it('requires confirmation before closing a referral', async () => {
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('inter-agency-referrals')) {
        return Promise.resolve([
          {
            id: 'r2',
            personId: 'p1',
            fromAgencyId: 'ag-2',
            toAgencyId: 'ag-1',
            status: 'actioned',
            reason: 'Medical follow-up needed',
            legalBasisCode: 'public_authority_sec13',
            createdAt: '2026-08-01T00:00:00.000Z',
            fromAgency: { id: 'ag-2', code: 'RHU', name: 'Rural Health Unit - Norzagaray' },
            toAgency: { id: 'ag-1', code: 'MSWDO', name: 'Municipal Social Welfare and Development Office' },
            person: { id: 'p1', firstName: 'Juan', surname: 'Dela Cruz' },
          },
        ]);
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

    const user = userEvent.setup();
    renderWithSWR(<InterAgencyReferralsPage />);
    await user.type(await screen.findByPlaceholderText('Outcome'), 'Completed');
    const closeButton = await screen.findByRole('button', { name: /close/i });
    await user.click(closeButton);
    expect(screen.getByText(/cannot be undone/i)).toBeDefined();
  });

  it('creates a referral from the form', async () => {
    const user = userEvent.setup();
    renderWithSWR(<InterAgencyReferralsPage />);

    await user.selectOptions(await screen.findByLabelText('To Agency *'), 'ag-2');
    await user.type(await screen.findByPlaceholderText('Search beneficiary by name...'), 'juan');
    await user.click(await screen.findByRole('button', { name: /Juan Dela Cruz/ }));
    await user.type(await screen.findByLabelText('Reason *'), 'Needs medical aid');
    await user.click(screen.getByRole('button', { name: 'Create Referral' }));

    expect(mockApiPost).toHaveBeenCalledWith('/inter-agency-referrals', {
      beneficiaryId: 'ben1',
      toAgencyId: 'ag-2',
      reason: 'Needs medical aid',
      notes: undefined,
      legalBasisCode: 'public_authority_sec13',
    });
  });
});
