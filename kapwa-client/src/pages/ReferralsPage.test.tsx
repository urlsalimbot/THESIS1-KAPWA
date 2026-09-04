import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { ReferralsPage } from './ReferralsPage';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));

vi.mock('@/lib/api', () => ({
  api: { get: (...args: unknown[]) => mockApiGet(...args), patch: vi.fn() },
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: (...args: unknown[]) => (useAuthMock as any)(...args),
}));

const useAuthMock = vi.fn();

function renderPage(role: string) {
  useAuthMock.mockReturnValue({ user: { role } });
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <MemoryRouter><ReferralsPage /></MemoryRouter>
    </SWRConfig>,
  );
}

function referral(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1', surname: 'Dela Cruz', firstName: 'Juan', barangay: 'Bigte',
    reason: 'Assistance needed', status: 'pending',
    createdAt: '2026-08-01T00:00:00Z', ...overrides,
  };
}

describe('ReferralsPage', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    useAuthMock.mockReset();
  });

  it('renders My Referrals for a coordinator with the New Referral action', async () => {
    mockApiGet.mockResolvedValue([referral()]);
    renderPage('coordinator');
    expect(await screen.findByText('My Referrals')).toBeTruthy();
    expect(screen.getByRole('button', { name: /New Referral/ })).toBeTruthy();
    expect(screen.getByText('Dela Cruz, Juan')).toBeTruthy();
    expect(mockApiGet).toHaveBeenCalledWith('/referrals/mine');
  });

  it('renders Pending Referrals for a worker with Accept/Decline actions', async () => {
    mockApiGet.mockResolvedValue([referral()]);
    renderPage('social_worker');
    expect(await screen.findByText('Pending Referrals')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Accept referral for Juan/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Decline referral for Juan/ })).toBeTruthy();
    expect(mockApiGet).toHaveBeenCalledWith('/referrals?status=pending');
  });
});