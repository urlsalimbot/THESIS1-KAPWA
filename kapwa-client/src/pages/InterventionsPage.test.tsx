import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { axe } from 'vitest-axe';
import { InterventionsPage } from './InterventionsPage';

const { mockApiGet, mockApiPost, mockInterventions } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
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

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: vi.fn(),
    del: vi.fn(),
    uploadSignature: vi.fn(),
    uploadReceipt: vi.fn(),
    dataURItoBlob: vi.fn(),
  },
}));

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </SWRConfig>,
  );
}

describe('InterventionsPage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('interventions')) return Promise.resolve(mockInterventions);
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('renders PageShell heading', async () => {
    renderWithSWR(<InterventionsPage />);
    expect(await screen.findByRole('heading', { name: 'Interventions' })).toBeTruthy();
  });

  it('renders intervention data from mock', async () => {
    renderWithSWR(<InterventionsPage />);
    expect(await screen.findByText('Juan Dela Cruz', {}, { timeout: 3000 })).toBeTruthy();
  });

  it('renders new intervention button', async () => {
    renderWithSWR(<InterventionsPage />);
    expect(await screen.findByRole('button', { name: /new intervention/i })).toBeTruthy();
  });

  it('has no a11y violations', async () => {
    const { container } = renderWithSWR(<InterventionsPage />);
    await screen.findByRole('heading', { name: 'Interventions' });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
