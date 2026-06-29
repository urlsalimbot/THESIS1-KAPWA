import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { InterventionsPage } from '../InterventionsPage';

const { mockInterventions } = vi.hoisted(() => ({
  mockInterventions: [
    {
      id: 'INT-001',
      caseId: 'C-001',
      interventionType: 'FA',
      amount: 5000,
      fundSource: 'Regular',
      agency: 'MSWDO',
      serviceDate: '2026-06-28',
      workerSignatureUrl: 'sig-url',
      signatureStatus: 'signed',
      clientReceiptUrl: null,
      case: {
        beneficiary: {
          firstName: 'Juan',
          surname: 'Dela Cruz',
        },
      },
    },
  ],
}));

vi.mock('../../lib/api', () => ({
  getInterventions: () => Promise.resolve(mockInterventions),
  createIntervention: vi.fn(),
  uploadSignature: vi.fn(),
  uploadReceipt: vi.fn(),
  dataURItoBlob: vi.fn(),
}));

describe('InterventionsPage', () => {
  it('renders PageShell heading', async () => {
    render(<MemoryRouter><InterventionsPage /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Interventions' })).toBeTruthy();
  });

  it('renders intervention data from mock', async () => {
    render(<MemoryRouter><InterventionsPage /></MemoryRouter>);
    expect(await screen.findByText('Juan Dela Cruz', {}, { timeout: 3000 })).toBeTruthy();
  });

  it('renders new intervention button', async () => {
    render(<MemoryRouter><InterventionsPage /></MemoryRouter>);
    expect(await screen.findByRole('button', { name: /new intervention/i })).toBeTruthy();
  });
});
