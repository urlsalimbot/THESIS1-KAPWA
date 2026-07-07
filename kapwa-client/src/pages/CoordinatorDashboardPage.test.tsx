import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

describe('CoordinatorDashboardPage', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValue({
      servedToday: 5,
      pendingReview: 2,
      urgentCount: 1,
      recentCases: [],
      unreadMessages: 1,
      servedChange: '+10%',
    });
  });

  it('renders PageShell heading', async () => {
    render(<MemoryRouter><CoordinatorDashboardPage /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Coordinator Dashboard' })).toBeTruthy();
  });
});
