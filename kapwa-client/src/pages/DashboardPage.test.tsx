import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from './DashboardPage';

vi.mock('../lib/api', () => ({
  getDashboard: vi.fn().mockResolvedValue({
    servedToday: 12,
    servedChange: '+8%',
    lastSync: '2m ago',
    pendingReview: 3,
    urgentCount: 1,
    disbursedMonth: 45000,
    beneficiaryCount: 28,
    recentCases: [
      { id: 'C-001', name: 'Juan Dela Cruz', category: 'Senior', barangay: 'Barangay 1', remarks: 'Monthly assistance', date: '2026-06-28', status: 'approved' },
    ],
  }),
}));

vi.mock('../lib/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'worker@test.com', fullName: 'Test Worker', role: 'social_worker' },
    token: 'mock-token',
    loading: false,
  }),
}));

describe('DashboardPage', () => {
  it('renders PageShell heading, stat cards, and case table with mock data', async () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeTruthy();
    expect(await screen.findByText('Served Today')).toBeTruthy();
    expect(await screen.findByText('C-001', {}, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByText('Juan Dela Cruz')).toBeTruthy();
  });
});
