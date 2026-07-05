import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ApprovalPipelinePage } from './ApprovalPipelinePage';

const { mockCases } = vi.hoisted(() => ({
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
  getCases: () => Promise.resolve(mockCases),
  updateCaseStatus: vi.fn(),
  updateCaseDocuments: vi.fn(),
  approveCase: vi.fn(),
}));

vi.mock('../lib/auth-context', () => ({
  getCurrentUser: () => Promise.resolve({ id: 'user-1', role: 'admin', name: 'Admin User' }),
}));

describe('ApprovalPipelinePage', () => {
  it('renders PageShell heading', async () => {
    render(<MemoryRouter><ApprovalPipelinePage /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Approval Pipeline' })).toBeTruthy();
  });

  it('renders case data from mock', async () => {
    render(<MemoryRouter><ApprovalPipelinePage /></MemoryRouter>);
    expect(await screen.findByText('NORZ-2026-0001', {}, { timeout: 3000 })).toBeTruthy();
    expect(await screen.findByText('NORZ-2026-0002')).toBeTruthy();
  });

  it('renders pipeline column headers', async () => {
    render(<MemoryRouter><ApprovalPipelinePage /></MemoryRouter>);
    // Use getAllByText since In Review appears in both column header and badge
    const inReviewElements = await screen.findAllByText('In Review');
    expect(inReviewElements.length).toBeGreaterThan(0);
    expect(await screen.findByText('Disbursed')).toBeTruthy();
  });
});
