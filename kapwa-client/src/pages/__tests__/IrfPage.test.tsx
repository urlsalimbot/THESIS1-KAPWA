import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { IrfPage } from '../IrfPage';

const { mockIrfs } = vi.hoisted(() => ({
  mockIrfs: [
    {
      id: 'IRF-001',
      blotterEntryNumber: 'BL-2026-0001',
      caseCategory: 'Abuse',
      datetimeReported: '2026-06-28T00:00:00Z',
      itemAReportingPerson: { name: 'Maria Santos', contact: '09170000001' },
      caseDisposition: 'Open',
      createdAt: '2026-06-28T00:00:00Z',
    },
  ],
}));

vi.mock('../../lib/api', () => ({
  getIrfRecords: vi.fn(() => Promise.resolve(mockIrfs)),
  createIrf: vi.fn(),
  exportIrfPdf: vi.fn(),
  exportIrfJson: vi.fn(),
}));

describe('IrfPage', () => {
  it('renders PageShell heading', async () => {
    render(<MemoryRouter><IrfPage /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Incident Report Forms (IRF)' })).toBeTruthy();
  });

  it('renders description text', async () => {
    render(<MemoryRouter><IrfPage /></MemoryRouter>);
    expect(await screen.findByText('VAWC/RA 9262 cases — MSWDO Norzagaray')).toBeTruthy();
  });

  it('renders records when loaded', async () => {
    render(<MemoryRouter><IrfPage /></MemoryRouter>);
    expect(await screen.findByText('BL-2026-0001')).toBeTruthy();
    expect(await screen.findByText('Maria Santos')).toBeTruthy();
  });

  it('renders + New IRF button', async () => {
    render(<MemoryRouter><IrfPage /></MemoryRouter>);
    expect(await screen.findByRole("button", { name: /new irf/i })).toBeTruthy();
  });
});
