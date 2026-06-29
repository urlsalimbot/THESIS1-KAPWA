import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { BeneficiaryViewPage } from '../BeneficiaryViewPage';

const { mockBeneficiary, mockCases, mockFamilyGraph, mockTrackerEntries } = vi.hoisted(() => ({
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
      { id: 'FM-1', fullName: 'Maria Dela Cruz', relationship: 'Spouse', age: 45, statusIncome: 'Employed', isPrimary: false },
    ],
  },
  mockTrackerEntries: [
    { id: 'T-1', trackerId: 'TRK-001', dailySeqNum: 1, interventionRemarks: 'Initial assessment' },
  ],
}));

vi.mock('../../lib/api', () => ({
  getBeneficiary: () => Promise.resolve(mockBeneficiary),
  getCases: () => Promise.resolve(mockCases),
  getFamilyGraph: () => Promise.resolve(mockFamilyGraph),
  getCaseTrackerLog: () => Promise.resolve(mockTrackerEntries),
  getConsentLedger: () => Promise.resolve({ records: [] }),
  createIntervention: vi.fn(),
  uploadSignature: vi.fn(),
  uploadReceipt: vi.fn(),
  dataURItoBlob: vi.fn(),
  assignCard: vi.fn(),
}));

describe('BeneficiaryViewPage', () => {
  it('renders PageShell heading', async () => {
    render(
      <MemoryRouter initialEntries={['/beneficiaries/BEN-001']}>
        <Routes>
          <Route path="/beneficiaries/:id" element={<BeneficiaryViewPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByRole('heading', { name: 'Beneficiary Details' })).toBeTruthy();
  });

  it('renders beneficiary name after load', async () => {
    render(
      <MemoryRouter initialEntries={['/beneficiaries/BEN-001']}>
        <Routes>
          <Route path="/beneficiaries/:id" element={<BeneficiaryViewPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText('Juan Dela Cruz', {}, { timeout: 5000 })).toBeTruthy();
  });

  it('renders Access Card section with card code', async () => {
    render(
      <MemoryRouter initialEntries={['/beneficiaries/BEN-001']}>
        <Routes>
          <Route path="/beneficiaries/:id" element={<BeneficiaryViewPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText('NORZ-AC-2026-0001', {}, { timeout: 5000 })).toBeTruthy();
  });
});
