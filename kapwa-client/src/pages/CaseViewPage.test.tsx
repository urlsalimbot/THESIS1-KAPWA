import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { CaseViewPage } from './CaseViewPage';

const { mockApiGet, mockGetFilingObjectUrl, mockUseAuth, mockDownloadGisPdf } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockGetFilingObjectUrl: vi.fn(),
  mockUseAuth: vi.fn(),
  mockDownloadGisPdf: vi.fn(),
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
  downloadFilingDoc: vi.fn(),
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

describe('CaseViewPage — 4Ps compliance', () => {
  it('shows the compliance section for a Pantawid case', async () => {
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

    expect(await screen.findByText('4Ps Compliance')).toBeInTheDocument();
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
    return screen.getByText('Implement HIP').closest('button')!;
  }

  function deliveryStepButton() {
    return screen.getByText('Service Delivery').closest('button')!;
  }

  it('keeps Implement HIP unchecked when an intervention exists but required documents are missing', async () => {
    renderWithSWR(<CaseViewPage />);
    const step2 = await waitFor(hipStepButton);
    expect(step2.textContent).toContain('2');
  });

  it('checks Implement HIP once the required document is uploaded', async () => {
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('caseId')) return Promise.resolve([{ requirementKey: 'Valid ID', originalName: 'id.pdf' }]);
      if (k.includes('history')) return Promise.resolve([]);
      if (k.includes('interventions')) return Promise.resolve(interventionMock);
      if (k.includes('family-graph')) return Promise.resolve({ members: [], primary: null });
      if (k.includes('inter-agency-referrals')) return Promise.resolve([]);
      if (k.includes('programs')) return Promise.resolve(programsMock);
      if (k.includes('cases')) return Promise.resolve(assumptionCase);
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });

    renderWithSWR(<CaseViewPage />);
    const step2 = await waitFor(hipStepButton);
    await waitFor(() => expect(step2.querySelector('svg')).not.toBeNull());
  });

  it('keeps Service Delivery unchecked until a referral is issued or deemed not needed', async () => {
    renderWithSWR(<CaseViewPage />);
    const step3 = await waitFor(deliveryStepButton);
    expect(step3.textContent).toContain('3');
  });

  it('checks Service Delivery when the case records referral-not-needed', async () => {
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
});