import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { CaseViewPage } from './CaseViewPage';

const { mockApiGet, mockApiPatch, mockGetFilingObjectUrl, mockUseAuth, mockDownloadGisPdf, mockDownloadFilingDoc } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPatch: vi.fn(),
  mockGetFilingObjectUrl: vi.fn(),
  mockUseAuth: vi.fn(),
  mockDownloadGisPdf: vi.fn(),
  mockDownloadFilingDoc: vi.fn(),
}));

vi.mock('../components/family/FamilyGraph', () => ({
  FamilyGraph: () => <div data-testid="family-graph-mock">Family Graph</div>,
}));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: vi.fn(),
    patch: (...args: unknown[]) => mockApiPatch(...args),
    put: vi.fn(),
    del: vi.fn(),
  },
  getFilingObjectUrl: (...args: unknown[]) => mockGetFilingObjectUrl(...args),
  downloadCsrPdf: vi.fn(),
  downloadFilingDoc: (...args: unknown[]) => mockDownloadFilingDoc(...args),
  filingDocIdFromUrl: (url: string) => {
    const match = /\/filing\/([^/]+)\/download/.exec(url);
    return match ? match[1] : null;
  },
  downloadGisPdf: (...args: unknown[]) => mockDownloadGisPdf(...args),
}));

vi.mock('../lib/auth-context', () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

const mockCase = {
  id: 'C-001',
  controlNo: 'NORZ-2026-0042',
  status: 'active',
  serviceRequested: ['Financial Assistance'],
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-02T00:00:00Z',
  assignedWorker: { fullName: 'Test Worker' },
  slaOverdue: false,
  beneficiary: {
    id: 'BEN-001',
    firstName: 'Juan',
    middleName: '',
    surname: 'Dela Cruz',
    gender: 'Male',
    dob: '1990-05-15',
    address: 'Purok 1, Barangay 1',
    household: { barangay: 'Bigte', estimatedIncome: 8500 },
  },
};

const mockIdPhoto = { id: 'FILE-IDPHOTO-1', originalName: 'id-photo.jpeg', category: 'id_photo' };

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
      <MemoryRouter initialEntries={['/cases/C-001']}>
        <Routes>
          <Route path="/cases/:id" element={ui} />
        </Routes>
      </MemoryRouter>
    </SWRConfig>,
  );
}

/** Fetches made against the case-detail key specifically, in order. */
function detailFetches(): unknown[][] {
  return mockApiGet.mock.calls.filter((c) => JSON.stringify(c[0]) === JSON.stringify(['cases', 'C-001']));
}

describe('CaseViewPage — government ID photo', () => {
  beforeAll(() => {
    // jsdom does not implement blob URL APIs; the component arms a getFilingObjectUrl
    // mock and revokes the object URL in effect cleanup, so cap both.
    if (typeof URL.createObjectURL !== 'function') {
      URL.createObjectURL = vi.fn(() => 'blob:mock') as unknown as typeof URL.createObjectURL;
    }
    if (typeof URL.revokeObjectURL !== 'function') {
      URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
    }
  });

  beforeEach(async () => {
    mockApiGet.mockReset();
    mockGetFilingObjectUrl.mockReset();
    mockUseAuth.mockReset();
    mockDownloadFilingDoc.mockReset();
    mockGetFilingObjectUrl.mockResolvedValue('blob:mock-id-photo');
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('id-photo')) return Promise.resolve(mockIdPhoto);
      if (k.includes('caseIdPhoto')) return Promise.resolve(mockIdPhoto);
      if (k.includes('history')) return Promise.resolve([]);
      if (k.includes('interventions')) return Promise.resolve([]);
      if (k.includes('family-graph')) return Promise.resolve({ members: [], primary: null });
      if (k.includes('inter-agency-referrals')) return Promise.resolve([]);
      if (k.includes('caseId')) return Promise.resolve([]);
      if (k.includes('cases')) return Promise.resolve(mockCase);
      return Promise.resolve(null);
    });
    // Clear the global SWR cache so each test gets a fresh useSWR fetch.
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('shows the Government ID panel when a photo is returned for an admin', async () => {
    mockUseAuth.mockReturnValue({ user: { id: '1', fullName: 'Admin', role: 'admin' } });

    renderWithSWR(<CaseViewPage />);

    expect(await screen.findByRole('heading', { name: 'Government ID' })).toBeTruthy();
    const img = await screen.findByAltText('Beneficiary government ID');
    expect(img).toHaveAttribute('src', 'blob:mock-id-photo');
    await vi.waitFor(() => {
      expect(mockGetFilingObjectUrl).toHaveBeenCalledWith('FILE-IDPHOTO-1');
    });
  });

  it('does not render the Government ID panel for a claimant', async () => {
    mockUseAuth.mockReturnValue({ user: { id: '2', fullName: 'Claimant', role: 'claimant' } });

    renderWithSWR(<CaseViewPage />);

    // Wait for the case to load so the sidebar/document area is mounted.
    await screen.findByText('Juan Dela Cruz');
    expect(screen.queryByRole('heading', { name: 'Government ID' })).toBeNull();
    expect(mockGetFilingObjectUrl).not.toHaveBeenCalled();
    const idPhotoCall = mockApiGet.mock.calls.find((args) => String(args[0]).includes('id-photo'));
    expect(idPhotoCall).toBeUndefined();
  });

  it('renders the beneficiary address', async () => {
    mockUseAuth.mockReturnValue({ user: { id: '1', fullName: 'Admin', role: 'admin' } });

    renderWithSWR(<CaseViewPage />);

    expect(await screen.findByText('Purok 1, Barangay 1')).toBeTruthy();
  });

  it('does not duplicate status-transition CTAs in the header — the step panels own them', async () => {
    // assessed + intervention: the old header duplicates ("Request Review",
    // "Submit for Review →") must not return.
    mockUseAuth.mockReturnValue({ user: { id: '3', fullName: 'SW', role: 'social_worker' } });
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('history')) return Promise.resolve([]);
      if (k.includes('interventions')) return Promise.resolve([{ id: 'i1', programId: 'p1', serviceName: 'Burial Assistance' }]);
      if (k.includes('family-graph')) return Promise.resolve({ members: [], primary: null });
      if (k.includes('inter-agency-referrals')) return Promise.resolve([]);
      if (k.includes('caseId')) return Promise.resolve([]);
      if (k.includes('cases')) return Promise.resolve({ ...mockCase, status: 'assessed', interventionNotNeeded: false });
      return Promise.resolve(null);
    });
    renderWithSWR(<CaseViewPage />);
    await screen.findByText('Juan Dela Cruz');
    expect(screen.queryByText('Request Review')).toBeNull();
    expect(screen.queryByText('Submit for Review →')).toBeNull();
  });

  it('mutates the case-detail key when the action bar reports a transition', async () => {
    // The regression the old "revalidates the case detail" test caught, carried
    // over to the component that now owns the transition. Passing the key in
    // SWR's *data* position makes `mutate` write a value instead of revalidating,
    // so the header status badge keeps saying "Assessed" until a full reload —
    // and the page then offers the same transition again.
    mockUseAuth.mockReturnValue({ user: { id: '3', fullName: 'SW', role: 'social_worker' } });
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('history')) return Promise.resolve([]);
      if (k.includes('interventions')) return Promise.resolve([{ id: 'i1', programId: 'p1', serviceName: 'Burial Assistance' }]);
      if (k.includes('family-graph')) return Promise.resolve({ members: [], primary: null });
      if (k.includes('inter-agency-referrals')) return Promise.resolve([]);
      if (k.includes('caseId')) return Promise.resolve([]);
      // Every step *due* at `assessed` sealed, or the bar's own gate (correctly)
      // keeps the button disabled and there is nothing to click.
      if (k.includes('cases')) {
        return Promise.resolve({
          ...mockCase,
          status: 'assessed',
          interventionNotNeeded: false,
          frvaScore: 30,
          stepLocks: [0, 1, 2].map((stepIndex) => ({ stepIndex, lockedAt: '2026-10-01T09:00:00Z' })),
        });
      }
      return Promise.resolve(null);
    });

    renderWithSWR(<CaseViewPage />);

    const flag = await screen.findByRole('button', { name: /flag for admin review/i });
    expect(flag).toBeEnabled();
    const before = detailFetches().length;
    fireEvent.click(flag);
    fireEvent.click(await screen.findByRole('button', { name: /^confirm$/i }));

    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/cases/C-001/status', { status: 'in_review' }));
    // The detail key is re-fetched, so the header status badge follows the
    // transition instead of waiting for a reload. Nothing else here re-fetches
    // that key — `mutate(['cases'], …)` matches `['cases']` exactly rather than
    // by prefix, which is what makes this count the assertion and not a
    // coincidence (verified by deleting the detail mutate: the count stays at 1).
    await waitFor(() => expect(detailFetches().length).toBeGreaterThan(before));
  });

  it('labels an in-case renewal with the linked case control number, not a UUID fragment', async () => {
    mockUseAuth.mockReturnValue({ user: { id: '1', fullName: 'Admin', role: 'admin' } });
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('history')) return Promise.resolve([]);
      if (k.includes('interventions')) return Promise.resolve([]);
      if (k.includes('family-graph')) return Promise.resolve({ members: [], primary: null });
      if (k.includes('inter-agency-referrals')) return Promise.resolve([]);
      if (k.includes('caseId')) return Promise.resolve([]);
      if (k.includes('cases')) return Promise.resolve({ ...mockCase, renewalOfCaseId: 'C-002' });
      return Promise.resolve(null);
    });
    renderWithSWR(<CaseViewPage />);
    expect(await screen.findByText('Renewal of case')).toBeTruthy();
    // The linked case resolves to the mocked case record -> its control number.
    const renewalLink = await screen.findByRole('button', { name: 'NORZ-2026-0042' });
    expect(renewalLink).toBeTruthy();
  });

  it('renders PSGC codes in the beneficiary address as names', async () => {
    mockUseAuth.mockReturnValue({ user: { id: '1', fullName: 'Admin', role: 'admin' } });
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('id-photo')) return Promise.resolve(mockIdPhoto);
      if (k.includes('caseIdPhoto')) return Promise.resolve(mockIdPhoto);
      if (k.includes('history')) return Promise.resolve([]);
      if (k.includes('interventions')) return Promise.resolve([]);
      if (k.includes('family-graph')) return Promise.resolve({ members: [], primary: null });
      if (k.includes('inter-agency-referrals')) return Promise.resolve([]);
      if (k.includes('caseId')) return Promise.resolve([]);
      if (k.includes('cases')) {
        return Promise.resolve({
          ...mockCase,
          beneficiary: {
            ...mockCase.beneficiary,
            currentAddress: { barangay: 'Poblacion', city: '0301413000', province: '0301400000' },
          },
        });
      }
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });

    renderWithSWR(<CaseViewPage />);

    expect(await screen.findByText('Poblacion, Norzagaray, Bulacan')).toBeTruthy();
  });

  it('shows Issue COE and Issue PCV to an admin on an active case without documents', async () => {
    mockUseAuth.mockReturnValue({ user: { id: '1', fullName: 'Admin', role: 'admin' }, loading: false });
    renderWithSWR(<CaseViewPage />);
    expect(await screen.findByRole('button', { name: /Issue COE/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Issue PCV/i })).toBeTruthy();
  });

  it('hides Issue COE and Issue PCV from an admin while the case is not active', async () => {
    // The server rejects issuing COE/PCV before activation (400) — showing the
    // buttons on an assessed case is a dead affordance with no error feedback.
    mockUseAuth.mockReturnValue({ user: { id: '1', fullName: 'Admin', role: 'admin' }, loading: false });
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('history')) return Promise.resolve([]);
      if (k.includes('interventions')) return Promise.resolve([]);
      if (k.includes('family-graph')) return Promise.resolve({ members: [], primary: null });
      if (k.includes('inter-agency-referrals')) return Promise.resolve([]);
      if (k.includes('caseId')) return Promise.resolve([]);
      if (k.includes('cases')) return Promise.resolve({ ...mockCase, status: 'assessed' });
      return Promise.resolve(null);
    });
    renderWithSWR(<CaseViewPage />);
    await screen.findByRole('button', { name: /GIS \(PDF\)/i });
    expect(screen.queryByRole('button', { name: /Issue COE/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Issue PCV/i })).toBeNull();
  });

  it('hides Issue COE and Issue PCV from non-admins', async () => {
    mockUseAuth.mockReturnValue({ user: { id: '2', fullName: 'Worker', role: 'social_worker' }, loading: false });
    renderWithSWR(<CaseViewPage />);
    await screen.findByRole('button', { name: /GIS \(PDF\)/i });
    expect(screen.queryByRole('button', { name: /Issue COE/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Issue PCV/i })).toBeNull();
  });

  it('downloads generated documents through the authenticated helper instead of opening the raw URL', async () => {
    mockUseAuth.mockReturnValue({ user: { id: '1', fullName: 'Admin', role: 'admin' } });
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('history')) return Promise.resolve([]);
      if (k.includes('interventions')) return Promise.resolve([]);
      if (k.includes('family-graph')) return Promise.resolve({ members: [], primary: null });
      if (k.includes('inter-agency-referrals')) return Promise.resolve([]);
      if (k.includes('caseId')) return Promise.resolve([]);
      if (k.includes('cases')) {
        return Promise.resolve({
          ...mockCase,
          certificateUrl: '/filing/FILE-COE-1/download',
          pettyCashVoucherUrl: '/filing/FILE-PCV-2/download',
        });
      }
      return Promise.resolve(null);
    });
    renderWithSWR(<CaseViewPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'View Certificate of Eligibility' }));
    expect(mockDownloadFilingDoc).toHaveBeenCalledWith('FILE-COE-1', 'certificate-of-eligibility.pdf');

    fireEvent.click(screen.getByRole('button', { name: 'View Petty Cash Voucher' }));
    expect(mockDownloadFilingDoc).toHaveBeenCalledWith('FILE-PCV-2', 'petty-cash-voucher.pdf');
  });
});

describe('CaseViewPage — GIS PDF', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockUseAuth.mockReset();
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('id-photo')) return Promise.resolve(mockIdPhoto);
      if (k.includes('caseIdPhoto')) return Promise.resolve(mockIdPhoto);
      if (k.includes('history')) return Promise.resolve([]);
      if (k.includes('interventions')) return Promise.resolve([]);
      if (k.includes('family-graph')) return Promise.resolve({ members: [], primary: null });
      if (k.includes('inter-agency-referrals')) return Promise.resolve([]);
      if (k.includes('caseId')) return Promise.resolve([]);
      if (k.includes('cases')) return Promise.resolve(mockCase);
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('downloads the GIS PDF when the button is clicked', async () => {
    mockUseAuth.mockReturnValue({ user: { id: '1', fullName: 'Admin', role: 'admin' } });
    renderWithSWR(<CaseViewPage />);
    const btn = await screen.findByRole('button', { name: /gis \(pdf\)/i });
    btn.click();
    expect(mockDownloadGisPdf).toHaveBeenCalledWith('C-001');
  });
});

describe('CaseViewPage — 4Ps', () => {
  it('shows the 4Ps Program button for a Pantawid case', async () => {
    mockUseAuth.mockReturnValue({ user: { id: '1', fullName: 'Admin', role: 'admin' } });
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('fourps')) return Promise.resolve({ total: 0, complied: 0, rate: 0, byType: {}, entries: [] });
      if (k.includes('history')) return Promise.resolve([]);
      if (k.includes('interventions')) return Promise.resolve([]);
      if (k.includes('family-graph')) return Promise.resolve({ members: [], primary: null });
      if (k.includes('inter-agency-referrals')) return Promise.resolve([]);
      if (k.includes('caseId')) return Promise.resolve([]);
      if (k.includes('cases')) {
        return Promise.resolve({ ...mockCase, serviceRequested: ['4Ps — Pantawid Pamilyang Pilipino Program'] });
      }
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });

    renderWithSWR(<CaseViewPage />);

    // 4Ps monitoring lives on its own page; the case view only links to it.
    expect(await screen.findByRole('button', { name: /4Ps Program/i })).toBeInTheDocument();
  });

  it('hides the 4Ps Program button for a non-Pantawid case', async () => {
    mockUseAuth.mockReturnValue({ user: { id: '1', fullName: 'Admin', role: 'admin' } });
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('fourps')) return Promise.resolve({ total: 0, complied: 0, rate: 0, byType: {}, entries: [] });
      if (k.includes('history')) return Promise.resolve([]);
      if (k.includes('interventions')) return Promise.resolve([]);
      if (k.includes('family-graph')) return Promise.resolve({ members: [], primary: null });
      if (k.includes('inter-agency-referrals')) return Promise.resolve([]);
      if (k.includes('caseId')) return Promise.resolve([]);
      if (k.includes('cases')) {
        return Promise.resolve({ ...mockCase, serviceRequested: ['Medical Assistance'], clientCategory: 'Indigent' });
      }
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });

    renderWithSWR(<CaseViewPage />);

    await screen.findByRole('button', { name: /Back to Cases/i });
    expect(screen.queryByRole('button', { name: /4Ps Program/i })).toBeNull();
  });
});

describe('CaseViewPage — stepper gating', () => {
  const programsMock = [{ id: 'p1', name: 'Medical Assistance', category: 'Medical', requiredDocuments: ['Valid ID'] }];
  const assumptionCase = {
    ...mockCase,
    status: 'assessed',
    problemsPresented: 'Financial difficulty',
    socialWorkerAssessment: 'Needs financial assistance',
    clientCategory: 'Indigent',
    frvaScore: 65,
  };
  const interventionMock = [{ id: 'i1', programId: 'p1', serviceName: 'Medical Assistance', deliveryDate: '2026-07-01', amount: 500 }];

  beforeEach(async () => {
    mockGetFilingObjectUrl.mockResolvedValue('blob:mock-id-photo');
    mockUseAuth.mockReturnValue({ user: { id: '1', fullName: 'SW', role: 'social_worker' } });
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('history')) return Promise.resolve([]);
      if (k.includes('interventions')) return Promise.resolve(interventionMock);
      if (k.includes('family-graph')) return Promise.resolve({ members: [], primary: null });
      if (k.includes('inter-agency-referrals')) return Promise.resolve([]);
      if (k.includes('programs')) return Promise.resolve(programsMock);
      if (k.includes('cases')) return Promise.resolve(assumptionCase);
      if (k.includes('caseId')) return Promise.resolve([]);
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });
  });

  // Queried by role and accessible name rather than by text: `CaseActionBar`
  // names the same five steps in prose when one is still open, so
  // `getByText` now matches twice and would throw instead of testing the
  // stepper. The stepper labels its own buttons "<n>. <label>", which is
  // unique to it.
  function hipStepButton() {
    return screen.getByRole('button', { name: '2. Intervention & Requirements' });
  }

  function deliveryStepButton() {
    return screen.getByRole('button', { name: '3. Inter-agency Referrals' });
  }

  it('keeps Intervention & Requirements unchecked when an intervention exists but required documents are missing', async () => {
    renderWithSWR(<CaseViewPage />);
    const step2 = await waitFor(hipStepButton);
    expect(step2.textContent).toContain('2');
  });

  it('checks Intervention & Requirements once every required document is confirmed', async () => {
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('caseId')) return Promise.resolve([{ requirementKey: 'Valid ID', originalName: 'id.pdf', verifiedAt: '2026-07-02T00:00:00Z' }]);
      if (k.includes('history')) return Promise.resolve([]);
      if (k.includes('interventions')) return Promise.resolve(interventionMock);
      if (k.includes('family-graph')) return Promise.resolve({ members: [], primary: null });
      if (k.includes('inter-agency-referrals')) return Promise.resolve([]);
      if (k.includes('programs')) return Promise.resolve(programsMock);
      if (k.includes('cases')) return Promise.resolve({ ...assumptionCase, requirementsChecklist: { 'Valid ID': true } });
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });

    renderWithSWR(<CaseViewPage />);
    const step2 = await waitFor(hipStepButton);
    await waitFor(() => expect(step2.querySelector('svg')).not.toBeNull());
  });

  it('keeps Inter-agency Referrals unchecked until a referral is issued or deemed not needed', async () => {
    renderWithSWR(<CaseViewPage />);
    const step3 = await waitFor(deliveryStepButton);
    expect(step3.textContent).toContain('3');
  });

  it('checks Inter-agency Referrals when the case records referral-not-needed', async () => {
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('history')) return Promise.resolve([]);
      if (k.includes('interventions')) return Promise.resolve(interventionMock);
      if (k.includes('family-graph')) return Promise.resolve({ members: [], primary: null });
      if (k.includes('inter-agency-referrals')) return Promise.resolve([]);
      if (k.includes('programs')) return Promise.resolve(programsMock);
      if (k.includes('caseId')) return Promise.resolve([{ requirementKey: 'Valid ID', originalName: 'id.pdf' }]);
      if (k.includes('cases')) return Promise.resolve({ ...assumptionCase, referralNotNeeded: true });
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });

    renderWithSWR(<CaseViewPage />);
    const step3 = await waitFor(deliveryStepButton);
    expect(step3.textContent).not.toContain('3');
    expect(step3.querySelector('svg')).not.toBeNull();
  });

  /**
   * The stepper and the server count the same rows.
   *
   * The scoped referral list is empty for a worker whose agency is not on a
   * referral, but the case carries one. Reading the scoped list here made the
   * stepper report step 2 incomplete — the same mismatch that stopped that
   * worker sealing the step. The case-level count is what both sides weigh.
   */
  it('checks Inter-agency Referrals on the case-level count even when the scoped list is empty', async () => {
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('history')) return Promise.resolve([]);
      if (k.includes('interventions')) return Promise.resolve(interventionMock);
      if (k.includes('family-graph')) return Promise.resolve({ members: [], primary: null });
      if (k.includes('inter-agency-referrals')) return Promise.resolve([]);
      if (k.includes('programs')) return Promise.resolve(programsMock);
      if (k.includes('caseId')) return Promise.resolve([{ requirementKey: 'Valid ID', originalName: 'id.pdf' }]);
      if (k.includes('cases')) return Promise.resolve({ ...assumptionCase, interAgencyReferralCount: 1 });
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });

    renderWithSWR(<CaseViewPage />);
    const step3 = await waitFor(deliveryStepButton);
    await waitFor(() => expect(step3.querySelector('svg')).not.toBeNull());
    expect(step3.textContent).not.toContain('3');
  });

  it('keeps the transition plan savable after the plan is saved while the case is active', async () => {
    // Regression: once the plan is saved (stepDone[3] flips true) the old
    // readOnly={stepDone[3] || caseClosed} hid the only "Save Transition Plan"
    // button — the worker could add follow-up visits but never persist them.
    mockUseAuth.mockReturnValue({ user: { id: '1', fullName: 'Admin', role: 'admin' } });
    let detailFetches = 0;
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('history')) return Promise.resolve([]);
      if (k.includes('interventions')) return Promise.resolve(interventionMock);
      if (k.includes('family-graph')) return Promise.resolve({ members: [], primary: null });
      if (k.includes('inter-agency-referrals')) return Promise.resolve([]);
      if (k.includes('programs')) return Promise.resolve(programsMock);
      if (k.includes('caseId')) return Promise.resolve([{ requirementKey: 'Valid ID', originalName: 'id.pdf', verifiedAt: '2026-07-02T00:00:00Z' }]);
      if (k.includes('cases')) {
        detailFetches += 1;
        return Promise.resolve(detailFetches === 1
          ? { ...assumptionCase, status: 'active', referralNotNeeded: true, requirementsChecklist: { 'Valid ID': true } }
          : { ...assumptionCase, status: 'active', referralNotNeeded: true, requirementsChecklist: { 'Valid ID': true }, selfRelianceLevel: 3, sustainabilityPlan: 'sari-sari store' });
      }
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });

    renderWithSWR(<CaseViewPage />);

    // Steps 0-2 done + plan not saved yet -> initial nav lands on Evaluate Help Given.
    const saveBtn = await screen.findByRole('button', { name: /Save Transition Plan/i });
    expect(saveBtn).toBeTruthy();

    // Fill in the plan and save it.
    fireEvent.click(screen.getByLabelText(/Level 3 - Self-Sufficient/i));
    fireEvent.change(screen.getAllByRole('textbox')[0] as HTMLElement, { target: { value: 'sari-sari store' } });
    fireEvent.click(saveBtn);

    // The refetched case now has the plan saved (stepDone[3] = true) — the
    // Save button must NOT disappear while the case is still active.
    await waitFor(() => expect(detailFetches).toBe(2));
    expect(screen.getByRole('button', { name: /Save Transition Plan/i })).toBeTruthy();
  });
});
// Step 5's seal is the one control whose readOnly signal cannot come from the
// step's own body: `CaseViewPage` passes `readOnly={stepDone[4] || caseClosed}` to
// StepClosure, and `stepDone[4]` flips true exactly when the closure is complete
// — which is exactly when the step becomes sealable. Routing that signal to the
// bar rendered `null` on the only step it was written for, so the case could
// never be closed with a seal. Nothing below the page can see that wiring.
describe('CaseViewPage — step 5 is sealable once its closure is complete', () => {
  const SIGNATURE = 'data:image/png;base64,iVBORw0KGgo=';
  /** Every step done, so the initial navigation lands on step 5 (Case Study & Closure). */
  const closureComplete = {
    ...mockCase,
    status: 'transitioning',
    problemsPresented: 'Financial difficulty',
    socialWorkerAssessment: 'Needs financial assistance',
    clientCategory: 'Indigent',
    frvaScore: 65,
    selfRelianceLevel: 3,
    sustainabilityPlan: 'sari-sari store',
    clientSignature: SIGNATURE,
    closureOutcome: 'graduated',
    // Step 2's completion is the case-level referral count, which the detail
    // endpoint stamps. The scoped list below is for display; without this field
    // the nav stops at step 2 and never reaches the closure this describe tests.
    interAgencyReferralCount: 1,
  };

  beforeEach(async () => {
    mockGetFilingObjectUrl.mockResolvedValue('blob:mock-id-photo');
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue({ user: { id: '1', fullName: 'Admin', role: 'admin' } });
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('id-photo') || k.includes('caseIdPhoto')) return Promise.resolve(null);
      if (k.includes('history')) return Promise.resolve([]);
      if (k.includes('interventions')) {
        return Promise.resolve([{ id: 'iv-1', programId: 'p1', serviceName: 'Medical Assistance' }]);
      }
      if (k.includes('family-graph')) return Promise.resolve({ members: [], primary: null });
      // A referral, from the same list step 3 issues into. Step 3 is "done" for
      // this case only because of it — `caseData.referrals` (the transition
      // plan's agency list) no longer completes the step, and with no referral and
      // no decision the initial navigation would stop at step 3 rather than
      // reaching the closure this describe is about.
      if (k.includes('inter-agency-referrals')) {
        return Promise.resolve([{ id: 'iar-1', toAgencyId: 'ag-rhu', reason: 'Medical coordination', status: 'referred' }]);
      }
      if (k.includes('programs')) return Promise.resolve([]);
      if (k.includes('caseId')) return Promise.resolve([]);
      if (k.includes('cases')) return Promise.resolve(closureComplete);
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('offers the Lock on a done-but-unsealed step 5, while the closure form is locked down', async () => {
    renderWithSWR(<CaseViewPage />);

    // Step 5 has to be the one on screen: the nav lands on the first pending
    // step, and a case with all five done lands on the last.
    await screen.findByRole('heading', { name: 'Case Closure' });
    expect(screen.getByRole('button', { name: '5. Case Study & Closure' })).toHaveAttribute('aria-current', 'step');

    // The step really is read-only — its own Save is gone, because the closure
    // is complete. This is the state that used to swallow the Lock button too.
    expect(screen.queryByRole('button', { name: /Save Progress/i })).toBeNull();

    // And the seal is still offered, which is the whole point of the split.
    const lock = await screen.findByRole('button', { name: /^lock$/i });
    expect(lock).toBeEnabled();
  });

  /**
 * A sealed step 5 keeps its Unlock.
   *
   * This is the lockout this describe exists to prevent. A sealed step's strip
   * says "unlock it to make changes, then seal it again" — so withholding the
   * Unlock behind the same flag that read-onlys the step body tells the worker to
   * do something the screen offers no way to do, and recovery needs a raw
   * `DELETE /cases/:id/steps/4/lock`. The seal's `readOnly` is a *different*
   * signal from the step body's, and step 5 is where the two were conflated: the
   * body goes read-only on the seal, the Unlock must not.
   */
  describe('step 5 sealed', () => {
    async function renderStepFive(seals: unknown[], over: Record<string, unknown> = {}) {
      mockApiGet.mockImplementation((key: unknown) => {
        const k = JSON.stringify(key);
        if (k.includes('id-photo') || k.includes('caseIdPhoto')) return Promise.resolve(null);
        if (k.includes('history')) return Promise.resolve([]);
        if (k.includes('interventions')) {
          return Promise.resolve([{ id: 'iv-1', programId: 'p1', serviceName: 'Medical Assistance' }]);
        }
        if (k.includes('family-graph')) return Promise.resolve({ members: [], primary: null });
        if (k.includes('inter-agency-referrals')) {
          return Promise.resolve([{ id: 'iar-1', toAgencyId: 'ag-rhu', reason: 'Medical coordination', status: 'referred' }]);
        }
        if (k.includes('programs')) return Promise.resolve([]);
        if (k.includes('caseId')) return Promise.resolve([]);
        if (k.includes('cases')) return Promise.resolve({ ...closureComplete, ...over, stepLocks: seals });
        return Promise.resolve(null);
      });
      await mutate(() => true, undefined, { revalidate: false });
      return renderWithSWR(<CaseViewPage />);
    }

    it('shows the seal and offers the release', async () => {
      await renderStepFive([{ stepIndex: 4, lockedByName: 'Ana Cruz', lockedAt: '2026-10-01T09:00:00Z' }]);

      // The strip names who sealed it…
      expect(await screen.findByText(/Locked by Ana Cruz/)).toBeTruthy();
      // …and it tells the worker that unlocking is how to change the step, so the
      // button that does it has to be there.
      expect(
        screen.getByText(/This step is sealed\. Unlock it to make changes, then seal it again\./),
      ).toBeTruthy();
      expect(screen.getByRole('button', { name: /^unlock$/i })).toBeTruthy();
    });

    it('reads the step body as read-only while offering the release', async () => {
      // The closure is deliberately *not* complete, so `stepDone[4]` cannot be
      // what read-onlys the body — only the seal can. With a complete closure
      // the body would be read-only seal or not, and this would stay green if
      // the page stopped folding the seal in at all.
      await renderStepFive(
        [{ stepIndex: 4, lockedByName: 'Ana Cruz', lockedAt: '2026-10-01T09:00:00Z' }],
        { clientSignature: null, closureOutcome: null },
      );

      // Step 5 is the step on screen, and the body it owns is frozen. The
      // CaseActionBar below also offers a "Close Case" hop, so the body
      // assertions are the closure form's own controls, not that button.
      await screen.findByRole('heading', { name: 'Case Closure' });
      expect(screen.queryByRole('button', { name: /Save Progress/i })).toBeNull();
      expect(screen.getByRole('radio', { name: /Graduated/i })).toBeDisabled();
      expect(screen.getByPlaceholderText(/Final notes before case closure/)).toBeDisabled();
      // The seal withholds the body and nothing else: the release survives.
      expect(screen.getByRole('button', { name: /^unlock$/i })).toBeTruthy();
      expect(screen.queryByRole('button', { name: /^lock$/i })).toBeNull();
    });
  });

  it('withholds the Lock on a step 5 that is not done yet', async () => {
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('id-photo') || k.includes('caseIdPhoto')) return Promise.resolve(null);
      if (k.includes('history')) return Promise.resolve([]);
      if (k.includes('interventions')) {
        return Promise.resolve([{ id: 'iv-1', programId: 'p1', serviceName: 'Medical Assistance' }]);
      }
      if (k.includes('family-graph')) return Promise.resolve({ members: [], primary: null });
      if (k.includes('inter-agency-referrals')) {
        return Promise.resolve([{ id: 'iar-1', toAgencyId: 'ag-rhu', reason: 'Medical coordination', status: 'referred' }]);
      }
      if (k.includes('programs')) return Promise.resolve([]);
      if (k.includes('caseId')) return Promise.resolve([]);
      // No signature or outcome: step 5 is not done, so `readOnly` is false and
      // the bar is rendered — but disabled, with the reason. Steps 1-3 stay
      // complete (interventions, a referral, and the self-reliance plan), so the
      // nav lands on step 5 rather than stopping at an earlier step.
      if (k.includes('cases')) {
        return Promise.resolve({
          ...closureComplete,
          clientSignature: null,
          closureOutcome: null,
        });
      }
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });

    renderWithSWR(<CaseViewPage />);

    // The nav lands on the first pending step. Step 5 has to be the one on
    // screen for this to be about step 5 at all: steps 1-3 are done, step 5 is
    // not (no signature or outcome). Nulling step 4's data as well would stop
    // the nav at step 4 and this would assert a different step's bar.
    await screen.findByRole('heading', { name: 'Case Closure' });

    const lock = await screen.findByRole('button', { name: /^lock$/i });
    expect(lock).toBeDisabled();
  });
});

describe('CaseViewPage — who acted on this case', () => {
  beforeAll(() => {
    if (typeof URL.createObjectURL !== 'function') {
      URL.createObjectURL = vi.fn(() => 'blob:mock') as unknown as typeof URL.createObjectURL;
    }
    if (typeof URL.revokeObjectURL !== 'function') {
      URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
    }
  });

  beforeEach(async () => {
    mockApiGet.mockReset();
    mockUseAuth.mockReset();
    mockGetFilingObjectUrl.mockResolvedValue('blob:mock-id-photo');
    await mutate(() => true, undefined, { revalidate: false });
  });

  function stub(opts: { history?: unknown[]; caseData?: Record<string, unknown> } = {}) {
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('history')) return Promise.resolve(opts.history ?? []);
      if (k.includes('id-photo') || k.includes('caseIdPhoto')) return Promise.resolve(null);
      if (k.includes('interventions')) return Promise.resolve([]);
      if (k.includes('family-graph')) return Promise.resolve({ members: [], primary: null });
      if (k.includes('inter-agency-referrals')) return Promise.resolve([]);
      if (k.includes('caseId')) return Promise.resolve([]);
      if (k.includes('cases')) return Promise.resolve({ ...mockCase, ...(opts.caseData ?? {}) });
      return Promise.resolve(null);
    });
  }

  it('names the actor and their role in the case history', async () => {
    mockUseAuth.mockReturnValue({ user: { id: '1', fullName: 'Admin', role: 'admin' } });
    stub({
      history: [
        {
          id: 'h1', fromStatus: 'assessed', toStatus: 'in_review', transitionType: 'standard',
          createdAt: '2026-06-02T00:00:00Z',
          changedById: 'u9', changedByRole: 'social_worker', changedByName: 'Lorna Santos',
        },
      ],
    });

    renderWithSWR(<CaseViewPage />);

    // A bare role slug is unactionable for a supervisor reading the trail.
    expect(await screen.findByText(/Lorna Santos — MSWDO Social Worker/)).toBeTruthy();
  });

  it('falls back to the role alone when the entry has no resolvable actor', async () => {
    mockUseAuth.mockReturnValue({ user: { id: '1', fullName: 'Admin', role: 'admin' } });
    stub({
      history: [
        {
          id: 'h2', fromStatus: null, toStatus: 'enrolled', transitionType: 'standard',
          createdAt: '2026-06-01T00:00:00Z',
          changedById: null, changedByRole: 'admin', changedByName: null,
        },
      ],
    });

    renderWithSWR(<CaseViewPage />);

    expect(await screen.findByText(/by MSWDO Admin/)).toBeTruthy();
  });

  it('shows Approved By as the same name — role pair', async () => {
    mockUseAuth.mockReturnValue({ user: { id: '1', fullName: 'Admin', role: 'admin' } });
    stub({ caseData: { approvedByName: 'Lorna Santos', approvedByRole: 'social_worker' } });

    renderWithSWR(<CaseViewPage />);

    const approved = await screen.findByText('Lorna Santos — MSWDO Social Worker');
    expect(approved.textContent).toBe('Lorna Santos — MSWDO Social Worker');
  });
});

describe('CaseViewPage — inter-agency referral rows', () => {
  const mockReferral = {
    id: 'IAR-1',
    status: 'referred',
    createdAt: '2026-07-01T00:00:00Z',
    person: { firstName: 'Maria', surname: 'Reyes' },
    fromAgency: { code: 'MSWDO', name: 'MSWDO Norzagaray' },
    toAgency: { code: 'PESO', name: 'PESO Norzagaray' },
  };

  beforeEach(async () => {
    mockApiGet.mockReset();
    mockUseAuth.mockReset();
    mockDownloadFilingDoc.mockReset();
    mockGetFilingObjectUrl.mockResolvedValue('blob:mock-id-photo');
    mockUseAuth.mockReturnValue({ user: { id: '1', fullName: 'Admin', role: 'admin' }, loading: false });
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('id-photo') || k.includes('caseIdPhoto')) return Promise.resolve(null);
      if (k.includes('history')) return Promise.resolve([]);
      if (k.includes('interventions')) return Promise.resolve([]);
      if (k.includes('family-graph')) return Promise.resolve({ members: [], primary: null });
      // One row, so the list is populated — an empty-state-only assertion would
      // pass whether or not the row still pretended to be a link.
      if (k.includes('inter-agency-referrals')) return Promise.resolve([mockReferral]);
      if (k.includes('caseId')) return Promise.resolve([]);
      if (k.includes('cases')) return Promise.resolve(mockCase);
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('offers no way to leave the case for a referral — the detail route is retired', async () => {
    renderWithSWR(<CaseViewPage />);

    // The row must be on screen before the "no link" claims mean anything.
    const row = await screen.findByText('Maria Reyes');

    const hrefs = [...document.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs.filter((h) => h?.includes('/agency/referrals'))).toEqual([]);
    expect(screen.queryByRole('link', { name: /view details/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /view details/i })).toBeNull();
    // Nothing in the row is a navigation affordance at all.
    expect(row.closest('a, button')).toBeNull();
  });

  it('still shows the referral as a record — parties and status', async () => {
    renderWithSWR(<CaseViewPage />);

    expect(await screen.findByText('Maria Reyes')).toBeTruthy();
    expect(screen.getByText('MSWDO Norzagaray → PESO Norzagaray')).toBeTruthy();
    expect(screen.getByText('Referred')).toBeTruthy();
  });
});

/**
 * The page's own wiring for a sealed step.
 *
 * `StepLocksAcrossSteps.test.tsx` covers the five mounts with its own harness, so
 * it cannot catch a regression in *this* file's `readOnlyUnlessSealed` — a bar
 * whose default hid the seal's Unlock, or a mount wired to the wrong step index,
 * both render plausibly. These drive `CaseViewPage` itself.
 *
 * The second defect was exactly this: after sealing step 0, the worker could
 * still edit it and the seal stood on changed data. The server now refuses the
 * write (a 409 on `PATCH /cases/:id/assessment`), and the page stops offering a
 * control that cannot succeed. The strip stays, because it carries the Unlock:
 * a seal that could only be lifted by an API call would strand the worker who
 * set it.
 */
describe('CaseViewPage — a sealed step', () => {
  const STEP_ONE_SEALED = [
    { stepIndex: 0, lockedByName: 'Ana Cruz', lockedAt: '2026-10-01T09:00:00Z' },
  ];

  /**
   * Render the page and land on step 1's panel.
   *
   * Step 0 has to be *done* for this fixture to be about the seal at all — the
   * defect was a worker sealing a finished step and then editing it — and the
   * page navigates to the first *pending* step, so a done step 0 means it opens
   * on step 2 instead. Hence the deliberate click on the stepper: that is how a
   * worker reaches a sealed step's panel, and driving it through the real control
   * is what makes this a page-level test rather than a props test.
   */
  async function renderStepZero(seals: unknown[]) {
    mockUseAuth.mockReturnValue({ user: { id: '3', fullName: 'SW', role: 'social_worker' }, loading: false });
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('history')) return Promise.resolve([]);
      if (k.includes('interventions')) {
        return Promise.resolve([{ id: 'iv-1', programId: 'p1', serviceName: 'Medical Assistance' }]);
      }
      if (k.includes('family-graph')) return Promise.resolve({ members: [], primary: null });
      if (k.includes('inter-agency-referrals')) return Promise.resolve([]);
      if (k.includes('caseIdPhoto')) return Promise.resolve(null);
      if (k.includes('programs')) return Promise.resolve([]);
      if (k.includes('caseId')) return Promise.resolve([]);
      if (k.includes('cases')) {
        return Promise.resolve({
          ...mockCase,
          // `enrolled` keeps step 0 editable on its own, so the seal is the only
          // thing that can turn it read-only — which is what makes these
          // assertions about the seal and not about the lifecycle.
          status: 'enrolled',
          problemsPresented: 'Poverty',
          socialWorkerAssessment: 'Needs aid',
          clientCategory: 'Indigent',
          frvaScore: 65,
          stepLocks: seals,
        });
      }
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });
    const view = renderWithSWR(<CaseViewPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Assess & Interview/i }));
    return view;
  }

  beforeEach(async () => {
    mockApiGet.mockReset();
    mockUseAuth.mockReset();
    mockGetFilingObjectUrl.mockReset();
    mockGetFilingObjectUrl.mockResolvedValue('blob:mock-id-photo');
  });

  it('offers Save Assessment on a done, unsealed step 0', async () => {
    await renderStepZero([]);

    // The positive control. Without it, the assertion below could pass for the
    // wrong reason — a step-0 panel that never rendered a Save button at all
    // would satisfy "no Save button while sealed" just as well.
    expect(await screen.findByRole('button', { name: /Save Assessment/i })).toBeTruthy();
  });

  it('withholds Save Assessment once step 0 is sealed', async () => {
    await renderStepZero(STEP_ONE_SEALED);

    // The strip has to be on screen first, or the absence below would be the
    // panel still loading.
    expect(await screen.findByText(/Locked by Ana Cruz/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Save Assessment/i })).toBeNull();
  });

  it('keeps the release reachable on a sealed step — the strip is the only way out', async () => {
    await renderStepZero(STEP_ONE_SEALED);

    expect(await screen.findByRole('button', { name: /^unlock$/i })).toBeTruthy();
  });

  it('says on the strip that unlocking is how to change the step', async () => {
    await renderStepZero(STEP_ONE_SEALED);

    // Disabled fields with no account of why is the trust problem in miniature:
    // the user cannot tell a seal from a permission or from a bug.
    expect(
      await screen.findByText(/This step is sealed\. Unlock it to make changes, then seal it again\./),
    ).toBeTruthy();
  });

  it('leaves the other steps editable — a seal is per step', async () => {
    await renderStepZero(STEP_ONE_SEALED);

    // Sealing step 0 must not quietly read-only the whole case. That would be a
    // bigger version of the defect being fixed.
    fireEvent.click(await screen.findByRole('button', { name: /Intervention & Requirements/i }));
    expect(await screen.findByRole('button', { name: /Add Intervention/i })).toBeTruthy();
  });
});
