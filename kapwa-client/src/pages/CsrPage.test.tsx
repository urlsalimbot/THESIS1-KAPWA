import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { CsrPage } from './CsrPage';

const { mockApiGet, mockApiPost, mockApiPut, mockApiDel, mockRecords } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiPut: vi.fn(),
  mockApiDel: vi.fn(),
  mockRecords: [
    {
      id: 'CSR-001',
      caseId: 'CASE-001',
      controlNo: 'CSR-2026-0001',
      socialWorkerName: 'Juan Dela Cruz',
      socialWorkerPosition: 'SWO I',
      referralOrigin: 'Barangay 1',
      reasonForReferral: 'Financial assistance',
      problemPresented: 'Poverty',
      familyBackground: 'Single parent, 3 children',
      socioEconomicProfile: 'Low income',
      assessmentAnalysis: 'Qualifies for assistance',
      recommendation: 'Provide financial aid',
      interventionPlan: 'Monthly subsidy',
      clientSignatureUrl: '',
      workerSignatureUrl: '',
      finalized: true,
      createdBy: 'admin',
      createdAt: '2026-06-28T00:00:00Z',
      updatedAt: '2026-06-28T00:00:00Z',
    },
  ],
}));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
    del: (...args: unknown[]) => mockApiDel(...args),
    downloadCsrPdf: vi.fn(),
  },
}));

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </SWRConfig>,
  );
}

describe('CsrPage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiPut.mockReset();
    mockApiDel.mockReset();
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('csr') && k.includes('list')) return Promise.resolve(mockRecords);
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('renders PageShell heading', async () => {
    renderWithSWR(<CsrPage />);
    expect(await screen.findByRole('heading', { name: 'CSR Generator' })).toBeTruthy();
  });

  it('renders description text', async () => {
    renderWithSWR(<CsrPage />);
    expect(await screen.findByText('Family Case Study Reports — MSWDO Norzagaray')).toBeTruthy();
  });

  it('renders records when loaded', async () => {
    renderWithSWR(<CsrPage />);
    expect(await screen.findByText('CSR-2026-0001')).toBeTruthy();
    expect(await screen.findByText('Juan Dela Cruz')).toBeTruthy();
  });

  it('renders + New CSR button', async () => {
    renderWithSWR(<CsrPage />);
    expect(await screen.findByRole('button', { name: '+ New CSR' })).toBeTruthy();
  });
});
