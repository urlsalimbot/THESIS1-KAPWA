import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { axe } from 'vitest-axe';
import { ApprovalPipelinePage } from './ApprovalPipelinePage';

const { mockApiGet, mockApiPost, mockApiPut, mockCases } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiPut: vi.fn(),
  mockCases: [
    {
      id: 'C-001',
      controlNo: 'NORZ-2026-0001',
      status: 'in_review',
      serviceRequested: ['Financial Assistance'],
      certificateUrl: null,
      pettyCashVoucherUrl: null,
      beneficiary: { firstName: 'Juan', surname: 'Dela Cruz' },
      updatedAt: '2026-06-28T00:00:00Z',
    },
    {
      id: 'C-002',
      controlNo: 'NORZ-2026-0002',
      status: 'approved',
      serviceRequested: ['Counseling'],
      certificateUrl: '/api/filing/file/cert-001',
      pettyCashVoucherUrl: '/api/filing/file/pcv-001',
      beneficiary: { firstName: 'Maria', surname: 'Santos' },
      updatedAt: '2026-06-27T00:00:00Z',
    },
  ],
}));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
    del: vi.fn(),
  },
}));

vi.mock('../lib/auth-context', () => ({
  getCurrentUser: () => Promise.resolve({ id: 'user-1', role: 'admin', name: 'Admin User' }),
}));

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </SWRConfig>,
  );
}

describe('ApprovalPipelinePage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiPut.mockReset();
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('cases') && k.includes('list')) return Promise.resolve(mockCases);
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('renders PageShell heading', async () => {
    renderWithSWR(<ApprovalPipelinePage />);
    expect(await screen.findByRole('heading', { name: 'Approval Pipeline' })).toBeTruthy();
  });

  it('renders case data from mock', async () => {
    renderWithSWR(<ApprovalPipelinePage />);
    expect(await screen.findByText('NORZ-2026-0001', {}, { timeout: 3000 })).toBeTruthy();
    expect(await screen.findByText('NORZ-2026-0002')).toBeTruthy();
  });

  it('renders pipeline column headers', async () => {
    renderWithSWR(<ApprovalPipelinePage />);
    const inReviewElements = await screen.findAllByText('In Review');
    expect(inReviewElements.length).toBeGreaterThan(0);
    expect(await screen.findByText('Disbursed')).toBeTruthy();
  });

  it('has no a11y violations', async () => {
    const { container } = renderWithSWR(<ApprovalPipelinePage />);
    await screen.findByRole('heading', { name: 'Approval Pipeline' });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
