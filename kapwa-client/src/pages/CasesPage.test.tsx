import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CasesPage } from './CasesPage';

const { mockCases } = vi.hoisted(() => ({
  mockCases: [
    {
      id: 'C-001',
      controlNo: 'CN-001',
      status: 'approved',
      remarks: 'Monthly',
      updatedAt: '2026-06-28T00:00:00Z',
      slaOverdue: false,
      beneficiary: {
        surname: 'Dela Cruz',
        firstName: 'Juan',
        middleName: 'M',
        gender: 'M',
        address: 'Barangay 1',
      },
      serviceRequested: ['Senior'],
    },
  ],
}));

vi.mock('../lib/api', () => ({
  getCases: () => Promise.resolve(mockCases),
  requestReview: vi.fn(),
  disburseCase: vi.fn(),
  closeCase: vi.fn(),
  overrideCaseStatus: vi.fn(),
}));

vi.mock('../lib/sync', () => ({
  isOnline: () => true,
}));

vi.mock('../lib/offline-queue', () => ({
  queueFsmTransition: vi.fn(),
}));

describe('CasesPage', () => {
  it('renders PageShell heading', async () => {
    render(<MemoryRouter><CasesPage /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Case Tracker' })).toBeTruthy();
  });

  it('renders beneficiary surname from mock', async () => {
    render(<MemoryRouter><CasesPage /></MemoryRouter>);
    expect(await screen.findByText('Dela Cruz', {}, { timeout: 3000 })).toBeTruthy();
  });

  it('renders search input', async () => {
    render(<MemoryRouter><CasesPage /></MemoryRouter>);
    expect(await screen.findByPlaceholderText('Search records...')).toBeTruthy();
  });

  it('renders export CSV button', async () => {
    render(<MemoryRouter><CasesPage /></MemoryRouter>);
    expect(await screen.findByRole('button', { name: /export csv/i })).toBeTruthy();
  });

  it('snapshot: CasesPage rendered DOM with table layout + status badges + filter controls', async () => {
    const { container } = render(<MemoryRouter><CasesPage /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Case Tracker' })).toBeTruthy();
    expect(container).toMatchSnapshot();
  });
});
