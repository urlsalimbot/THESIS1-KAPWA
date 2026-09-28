import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { CoordinatorDashboardPage } from './CoordinatorDashboardPage';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
  },
}));

const dashboardPayload = {
  servedToday: 5,
  pendingReview: 2,
  urgentCount: 1,
  recentCases: [],
  unreadMessages: 1,
  servedChange: '+10%',
};

const summaryPayload = {
  cardCode: 'NORZ-AC-2026-0001',
  person: { id: 'p1', firstName: 'Maria', surname: 'Santos' },
  servicesRendered: [],
  servicesFromOtherAgencies: [],
  referralHistory: [],
  sharingConsentActive: true,
};

describe('CoordinatorDashboardPage', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiGet.mockImplementation((path: unknown) => {
      const p = typeof path === 'string' ? path : JSON.stringify(path);
      if (p.includes('/access-cards/') && p.includes('/summary')) {
        return Promise.resolve(summaryPayload);
      }
      return Promise.resolve(dashboardPayload);
    });
  });

  it('renders PageShell heading', async () => {
    render(<MemoryRouter><CoordinatorDashboardPage /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Coordinator Dashboard' })).toBeTruthy();
  });

  it('has no a11y violations', async () => {
    const { container } = render(<MemoryRouter><CoordinatorDashboardPage /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Coordinator Dashboard' });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders the quick-scan card for coordinators', async () => {
    render(<MemoryRouter><CoordinatorDashboardPage /></MemoryRouter>);
    expect(await screen.findByLabelText(/access card code/i)).toBeDefined();
  });

  it('verifies an access card code and shows the beneficiary', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><CoordinatorDashboardPage /></MemoryRouter>);
    await user.type(await screen.findByLabelText(/access card code/i), 'NORZ-AC-2026-0001');
    await user.click(screen.getByRole('button', { name: 'Verify Card' }));
    expect(await screen.findByText(/Maria Santos/)).toBeTruthy();
  });

  it('shows an error when the card code is not found', async () => {
    mockApiGet.mockRejectedValue(new Error('not found'));
    const user = userEvent.setup();
    render(<MemoryRouter><CoordinatorDashboardPage /></MemoryRouter>);
    await user.type(await screen.findByLabelText(/access card code/i), 'NORZ-AC-2026-9999');
    await user.click(screen.getByRole('button', { name: 'Verify Card' }));
    expect(await screen.findByText(/Card not found/)).toBeTruthy();
  });

  it('hides MSWDO-only stats and case search for coordinators', async () => {
    render(<MemoryRouter><CoordinatorDashboardPage /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Coordinator Dashboard' });
    expect(screen.queryByText('Served Today')).toBeNull();
    expect(screen.queryByText('Pending Cases')).toBeNull();
    expect(screen.queryByText('Quick Case Search')).toBeNull();
  });

  it('keeps coordinator-relevant stats and quick scan', async () => {
    render(<MemoryRouter><CoordinatorDashboardPage /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Coordinator Dashboard' });
    expect(screen.getByText('My Referrals')).toBeTruthy();
    expect(screen.getAllByText('Messages').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText(/access card code/i)).toBeDefined();
  });

  it('shows tracker row control numbers without a dead-end case link', async () => {
    // /cases/:id is MSWDO-only, so the old View button bounced coordinators
    // straight back. The control number is the reference they can quote instead.
    mockApiGet.mockImplementation((path: unknown) => {
      const p = typeof path === 'string' ? path : JSON.stringify(path);
      if (p.includes('/access-cards/') && p.includes('/summary')) {
        return Promise.resolve(summaryPayload);
      }
      const dashboardData = {
        ...dashboardPayload,
        recentCases: [
          {
            id: 'c1',
            date: '2026-09-01T00:00:00.000Z',
            name: 'Maria Santos',
            category: 'Medical',
            barangay: 'Bigte',
            remarks: '',
            controlNo: 'NORZ-2026-0007',
          },
        ],
      };
      return Promise.resolve(dashboardData);
    });

    render(<MemoryRouter><CoordinatorDashboardPage /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Coordinator Dashboard' });

    expect(await screen.findByText('NORZ-2026-0007')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /view case/i })).toBeNull();
    // The row is not a link to a case the coordinator cannot open.
    expect(screen.queryByRole('link', { name: /view case/i })).toBeNull();
  });
});
