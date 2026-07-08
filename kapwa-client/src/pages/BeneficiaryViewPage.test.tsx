import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { axe } from 'vitest-axe';
import { BeneficiaryViewPage } from './BeneficiaryViewPage';

const { mockApiGet, mockApiPost, mockApiPut, mockBeneficiary, mockCases, mockFamilyGraph, mockTrackerEntries } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiPut: vi.fn(),
  mockBeneficiary: {
    id: 'BEN-001',
    firstName: 'Juan',
    middleName: '',
    surname: 'Dela Cruz',
    dob: '1990-05-15',
    gender: 'Male',
    phone: '09171234567',
    address: 'Purok 1, Barangay 1',
    category: 'Senior',
    consentStatus: 'active',
    accessCardCode: 'NORZ-AC-2026-0001',
  },
  mockCases: [
    {
      id: 'C-001',
      controlNo: 'NORZ-2026-0001',
      beneficiaryId: 'BEN-001',
      status: 'approved',
      serviceRequested: ['Financial Assistance'],
      createdAt: '2026-06-01T00:00:00Z',
    },
  ],
  mockFamilyGraph: {
    totalCount: 3,
    members: [
      { id: 'FM-1', fullName: 'Maria Dela Cruz', relationship: 'Spouse', age: 45, statusIncome: 'Employed', isPrimary: false, depth: 1 },
    ],
  },
  mockTrackerEntries: [
    { id: 'T-1', trackerId: 'TRK-001', dailySeqNum: 1, interventionRemarks: 'Initial assessment' },
  ],
}));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
    del: vi.fn(),
    uploadSignature: vi.fn(),
    uploadReceipt: vi.fn(),
    dataURItoBlob: vi.fn(),
  },
  getFamilyGraph: vi.fn(() => Promise.resolve({ totalCount: 0, members: [] })),
  getConsentLedger: vi.fn(() => Promise.resolve([])),
  getBeneficiary: vi.fn(),
  getCases: vi.fn(),
}));

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      {ui}
    </SWRConfig>,
  );
}

describe('BeneficiaryViewPage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiPut.mockReset();
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('beneficiaries') && k.includes('detail')) return Promise.resolve(mockBeneficiary);
      if (k.includes('cases') && k.includes('list')) return Promise.resolve(mockCases);
      if (k.includes('family-graph')) return Promise.resolve(mockFamilyGraph);
      if (k.includes('tracker') && k.includes('list')) return Promise.resolve(mockTrackerEntries);
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('renders PageShell heading', async () => {
    renderWithSWR(
      <MemoryRouter initialEntries={['/beneficiaries/BEN-001']}>
        <Routes>
          <Route path="/beneficiaries/:id" element={<BeneficiaryViewPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByRole('heading', { name: 'Beneficiary Details' })).toBeTruthy();
  });

  it('renders beneficiary name after load', async () => {
    renderWithSWR(
      <MemoryRouter initialEntries={['/beneficiaries/BEN-001']}>
        <Routes>
          <Route path="/beneficiaries/:id" element={<BeneficiaryViewPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText('Juan Dela Cruz', {}, { timeout: 5000 })).toBeTruthy();
  });

  it('renders Access Card section with card code', async () => {
    renderWithSWR(
      <MemoryRouter initialEntries={['/beneficiaries/BEN-001']}>
        <Routes>
          <Route path="/beneficiaries/:id" element={<BeneficiaryViewPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText('NORZ-AC-2026-0001', {}, { timeout: 5000 })).toBeTruthy();
  });

  it('has no a11y violations', async () => {
    const { container } = renderWithSWR(
      <MemoryRouter initialEntries={['/beneficiaries/BEN-001']}>
        <Routes>
          <Route path="/beneficiaries/:id" element={<BeneficiaryViewPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByRole('heading', { name: 'Beneficiary Details' });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
