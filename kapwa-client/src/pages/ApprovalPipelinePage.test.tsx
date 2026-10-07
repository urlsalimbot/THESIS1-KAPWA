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
    // Every count and field the chips read, supplied. This pins the regression:
    // the page used to pass a literal `0` for enrollments and nothing at all for
    // court hearings, so a case that had accomplished both still drew those steps
    // as pending and no phase ever read as closed.
    {
      id: 'C-006',
      controlNo: 'NORZ-2026-0006',
      status: 'active',
      caseCategory: 'Children in Conflict with the Law (CICL)',
      serviceRequested: ['Financial Assistance'],
      certificateUrl: null,
      pettyCashVoucherUrl: null,
      beneficiary: { firstName: 'Eva', surname: 'Lopez' },
      updatedAt: '2026-06-23T00:00:00Z',
      problemsPresented: 'Presented',
      clientCategory: 'Indigent',
      socialWorkerAssessment: 'Assessed',
      discernmentAssessedAt: '2026-06-20',
      discernmentResult: 'discerned',
      interventionCount: 2,
      interAgencyReferralCount: 1,
      enrollmentCount: 3,
      courtHearingCount: 2,
      selfRelianceLevel: 3,
      sustainabilityPlan: 'Sari-sari store',
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

  // The counts the page used to omit: `enrollmentCount` was a literal 0 and
  // `courtHearingCount` was never passed, so a case that had accomplished both
  // still drew those steps as pending and no phase ever read as closed.
  it('marks every accomplished step done, including enrollments and court hearings', async () => {
    renderWithSWR(<ApprovalPipelinePage />);
    const label = await screen.findByText('NORZ-2026-0006');
    const card = label.closest('div.cursor-pointer') as HTMLElement;
    expect(card).toBeTruthy();

    // CICL carries 8 steps: assessment, discernment, enrollments, interventions,
    // referrals, court hearings, evaluate, closure.
    const chips = [...card.querySelectorAll('span.rounded-full')];
    expect(chips).toHaveLength(8);

    const done = chips.filter((c) => c.className.includes('bg-primary'));
    const pending = chips.filter((c) => c.className.includes('bg-muted'));
    // Everything accomplished reads as done; only Closure is left, floored at
    // `transitioning` while the case is still active.
    expect(done).toHaveLength(7);
    expect(pending).toHaveLength(1);
    expect(pending[0].textContent?.trim()).toBe('8');
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
