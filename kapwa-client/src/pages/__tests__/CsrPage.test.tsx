import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CsrPage } from '../CsrPage';

const { mockRecords } = vi.hoisted(() => ({
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

vi.mock('../../lib/api', () => ({
  getCsrRecords: vi.fn(() => Promise.resolve(mockRecords)),
  createCsrRecord: vi.fn(),
  updateCsrRecord: vi.fn(),
  deleteCsrRecord: vi.fn(),
  downloadCsrPdf: vi.fn(),
}));

describe('CsrPage', () => {
  it('renders PageShell heading', async () => {
    render(<MemoryRouter><CsrPage /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'CSR Generator' })).toBeTruthy();
  });

  it('renders description text', async () => {
    render(<MemoryRouter><CsrPage /></MemoryRouter>);
    expect(await screen.findByText('Family Case Study Reports — MSWDO Norzagaray')).toBeTruthy();
  });

  it('renders records when loaded', async () => {
    render(<MemoryRouter><CsrPage /></MemoryRouter>);
    expect(await screen.findByText('CSR-2026-0001')).toBeTruthy();
    expect(await screen.findByText('Juan Dela Cruz')).toBeTruthy();
  });

  it('renders + New CSR button', async () => {
    render(<MemoryRouter><CsrPage /></MemoryRouter>);
    expect(await screen.findByRole('button', { name: '+ New CSR' })).toBeTruthy();
  });
});
