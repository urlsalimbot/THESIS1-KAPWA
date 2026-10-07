import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { axe } from 'vitest-axe';
import { ApprovalPipelinePage } from './ApprovalPipelinePage';

const { mockApiGet, mockApiPost, mockApiPut, mockCases } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiPut: vi.fn(),
  mockCases: [
    {
      id: 'C-001',
      controlNo: 'NORZ-2026-0001',
      status: 'in_review',
      serviceRequested: ['Financial Assistance'],
      certificateUrl: null,
      pettyCashVoucherUrl: null,
      beneficiary: { firstName: 'Juan', surname: 'Dela Cruz' },
      updatedAt: '2026-06-28T00:00:00Z',
    },
    {
      id: 'C-002',
      controlNo: 'NORZ-2026-0002',
      status: 'active',
      serviceRequested: ['Counseling'],
      certificateUrl: '/api/filing/file/cert-001',
      pettyCashVoucherUrl: '/api/filing/file/pcv-001',
      beneficiary: { firstName: 'Maria', surname: 'Santos' },
      updatedAt: '2026-06-27T00:00:00Z',
    },
    // Phase-In's earlier levels. Without these the columns looked populated
    // while a case sitting at its own level rendered nowhere.
    {
      id: 'C-003',
      controlNo: 'NORZ-2026-0003',
      status: 'enrolled',
      serviceRequested: ['Educational Assistance'],
      certificateUrl: null,
      pettyCashVoucherUrl: null,
      beneficiary: { firstName: 'Ana', surname: 'Reyes' },
      updatedAt: '2026-06-26T00:00:00Z',
    },
    {
      id: 'C-004',
      controlNo: 'NORZ-2026-0004',
      status: 'assessed',
      serviceRequested: ['Medical Assistance'],
      certificateUrl: null,
      pettyCashVoucherUrl: null,
      beneficiary: { firstName: 'Ben', surname: 'Cruz' },
      updatedAt: '2026-06-25T00:00:00Z',
    },
    {
      id: 'C-005',
      controlNo: 'NORZ-2026-0005',
      status: 'closed',
      serviceRequested: ['Financial Assistance'],
      certificateUrl: null,
      pettyCashVoucherUrl: null,
      beneficiary: { firstName: 'Cara', surname: 'Diaz' },
      updatedAt: '2026-06-24T00:00:00Z',
    },
  ],
}));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
    del: vi.fn(),
  },
}));

vi.mock('../lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'user-1', role: 'admin', fullName: 'Admin User' }, token: 't', loading: false }),
}));

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </SWRConfig>,
  );
}

describe('ApprovalPipelinePage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiPut.mockReset();
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('cases')) {
        // The pipeline fetches each status separately; return only the cases
        // for the requested status so a case does not land in every column.
        // Matched on the quoted `"status":"…"` pair — a bare substring would let
        // `active` match inside unrelated text and silently empty the column.
        const statuses = ['enrolled', 'assessed', 'in_review', 'active', 'transitioning', 'closed'];
        const status = statuses.find((s) => k.includes(`"status":"${s}"`)) ?? null;
        const data = status ? mockCases.filter((c) => c.status === status) : mockCases;
        return Promise.resolve({ data, total: data.length });
      }
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('renders PageShell heading', async () => {
    renderWithSWR(<ApprovalPipelinePage />);
    expect(await screen.findByRole('heading', { name: 'Approval Pipeline' })).toBeTruthy();
  });

  it('renders case data from mock', async () => {
    renderWithSWR(<ApprovalPipelinePage />);
    expect(await screen.findByText('NORZ-2026-0001', {}, { timeout: 3000 })).toBeTruthy();
    expect(await screen.findByText('NORZ-2026-0002')).toBeTruthy();
  });

  // The pipeline draws every status of each phase. A case must appear once, in
  // the column for its own level — this guards the failure the deployed page
  // had, where Phase-In asked only for `in_review` so a case at `enrolled` or
  // `assessed` rendered nowhere at all.
  it('renders every case exactly once, in the column for its own status', async () => {
    renderWithSWR(<ApprovalPipelinePage />);
    await screen.findByText('NORZ-2026-0001', {}, { timeout: 3000 });
    for (const c of mockCases) {
      expect({ controlNo: c.controlNo, count: screen.queryAllByText(c.controlNo).length })
        .toEqual({ controlNo: c.controlNo, count: 1 });
    }
  });

  // The header count comes from the same array as the cards beneath it, so they
  // must agree — a count that does not match the cards is how an under-filled
  // column still looks populated.
  it('shows a Phase-In count equal to its enrolled + assessed + in_review cases', async () => {
    renderWithSWR(<ApprovalPipelinePage />);
    await screen.findByText('NORZ-2026-0001', {}, { timeout: 3000 });
    const phaseIn = screen.getByText('Phase-In').closest('h2');
    expect(phaseIn).toBeTruthy();
    expect(phaseIn!.textContent).toContain('3');
  });

  it('renders pipeline column headers aligned with the case stepper phases', async () => {
    renderWithSWR(<ApprovalPipelinePage />);
    expect((await screen.findAllByText('Phase-In')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('Implementation')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('Phase-Out')).length).toBeGreaterThan(0);
    // Status badges still present inside the cards
    const inReviewElements = await screen.findAllByText('In Review');
    expect(inReviewElements.length).toBeGreaterThan(0);
    const activeElements = await screen.findAllByText('Active');
    expect(activeElements.length).toBeGreaterThan(0);
  });

  it('has no a11y violations', async () => {
    const { container } = renderWithSWR(<ApprovalPipelinePage />);
    await screen.findByRole('heading', { name: 'Approval Pipeline' });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
