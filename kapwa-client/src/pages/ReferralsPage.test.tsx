import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReferralsPage } from './ReferralsPage';

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));

vi.mock('../lib/auth-context', () => ({ useAuth: () => mockUseAuth() }));

// The two surfaces /referrals routes to, per role. Stubbed so the assertions
// are about which one the route chose, not about either page's internals.
vi.mock('./CoordinatorReferralListPage', () => ({
  CoordinatorReferralListPage: () => <div>COORDINATOR-SURFACE</div>,
}));
vi.mock('./ReferralReviewPage', () => ({
  ReferralReviewPage: () => <div>MSWDO-SURFACE</div>,
}));

function asRole(role: string) {
  mockUseAuth.mockReturnValue({ user: { id: '1', role }, token: 't', loading: false });
}

describe('ReferralsPage', () => {
  beforeEach(() => mockUseAuth.mockReset());

  it('gives a coordinator their own send-and-track surface', () => {
    // A coordinator may only send: the API gates POST /referrals to
    // 'coordinator' and GET /referrals to 'admin'/'social_worker'.
    asRole('coordinator');
    render(<MemoryRouter><ReferralsPage /></MemoryRouter>);
    expect(screen.getByText('COORDINATOR-SURFACE')).toBeTruthy();
    expect(screen.queryByText('MSWDO-SURFACE')).toBeNull();
  });

  it.each(['admin', 'social_worker'])('gives %s the pending queue to accept and process', (role) => {
    asRole(role);
    render(<MemoryRouter><ReferralsPage /></MemoryRouter>);
    expect(screen.getByText('MSWDO-SURFACE')).toBeTruthy();
    expect(screen.queryByText('COORDINATOR-SURFACE')).toBeNull();
  });

  it('falls back to the MSWDO surface for a role with no referrals access', () => {
    // /referrals is not mounted for claimant, so this only guards the default.
    asRole('claimant');
    render(<MemoryRouter><ReferralsPage /></MemoryRouter>);
    expect(screen.getByText('MSWDO-SURFACE')).toBeTruthy();
  });
});
