import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { CaseViewPage } from './CaseViewPage';

const { mockApiGet, mockGetFilingObjectUrl, mockUseAuth, mockDownloadGisPdf, mockDownloadFilingDoc } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
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
    patch: vi.fn(),
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

  function hipStepButton() {
    return screen.getByText("Intervention & Requirements").closest('button')!;
  }

  function deliveryStepButton() {
    return screen.getByText("Inter-agency Referrals").closest('button')!;
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
