import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { axe } from 'vitest-axe';
import { IrfPage } from './IrfPage';

const { mockApiGet, mockApiPost, mockApiPut, mockIrfs } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiPut: vi.fn(),
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

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
    del: vi.fn(),
    exportIrfPdf: vi.fn(),
    exportIrfJson: vi.fn(),
  },
}));

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </SWRConfig>,
  );
}

describe('IrfPage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiPut.mockReset();
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('irf') && k.includes('list')) return Promise.resolve(mockIrfs);
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('renders PageShell heading', async () => {
    renderWithSWR(<IrfPage />);
    expect(await screen.findByRole('heading', { name: 'Incident Report Forms (IRF)' })).toBeTruthy();
  });

  it('renders description text', async () => {
    renderWithSWR(<IrfPage />);
    expect(await screen.findByText('VAWC/RA 9262 cases — MSWDO Norzagaray')).toBeTruthy();
  });

  it('renders records when loaded', async () => {
    renderWithSWR(<IrfPage />);
    expect(await screen.findByText('BL-2026-0001')).toBeTruthy();
    expect(await screen.findByText('Maria Santos')).toBeTruthy();
  });

  it('renders + New IRF button', async () => {
    renderWithSWR(<IrfPage />);
    expect(await screen.findByRole("button", { name: /new irf/i })).toBeTruthy();
  });

  it('has no a11y violations', async () => {
    const { container } = renderWithSWR(<IrfPage />);
    await screen.findByRole('heading', { name: 'Incident Report Forms (IRF)' });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
