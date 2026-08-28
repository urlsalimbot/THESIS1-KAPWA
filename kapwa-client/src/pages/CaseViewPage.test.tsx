import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { CaseViewPage } from './CaseViewPage';

const { mockApiGet, mockGetFilingObjectUrl, mockUseAuth } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockGetFilingObjectUrl: vi.fn(),
  mockUseAuth: vi.fn(),
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
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
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
});