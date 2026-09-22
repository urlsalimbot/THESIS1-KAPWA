import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { ReferralsPage } from './ReferralsPage';

const { mockApiGet, mockApiPatch, mockNavigate } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPatch: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    patch: (...args: unknown[]) => mockApiPatch(...args),
  },
}));

// Keep MemoryRouter real, but capture navigation so the handoff can be asserted.
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => mockNavigate,
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
    mockApiPatch.mockReset();
    mockNavigate.mockReset();
    useAuthMock.mockReset();
  });

  it('renders My Referrals for a coordinator with the New Referral action', async () => {
    mockApiGet.mockResolvedValue([referral()]);
    renderPage('coordinator');
    expect(await screen.findByText('My Referrals')).toBeTruthy();
    expect(screen.getByRole('button', { name: /New Referral/ })).toBeTruthy();
    expect(await screen.findByText('Dela Cruz, Juan')).toBeTruthy();
    expect(mockApiGet).toHaveBeenCalledWith('/referrals/mine');
  });

  it('renders Pending Referrals for a worker with Accept/Decline actions', async () => {
    mockApiGet.mockResolvedValue([referral()]);
    renderPage('social_worker');
    expect(await screen.findByText('Pending Referrals')).toBeTruthy();
    // The accessible name carries the full name schema, not just the first name.
    expect(await screen.findByRole('button', { name: /Accept referral for Dela Cruz, Juan/ })).toBeTruthy();
    expect(await screen.findByRole('button', { name: /Decline referral for Dela Cruz, Juan/ })).toBeTruthy();
    expect(mockApiGet).toHaveBeenCalledWith('/referrals?status=pending');
  });

  it('hands off to a pre-filled intake when a referral is accepted', async () => {
    const accepted = referral({ personId: 'person-1', caseId: null, status: 'accepted' });
    mockApiGet.mockResolvedValue([referral({ personId: 'person-1' })]);
    mockApiPatch.mockResolvedValue(accepted);
    renderPage('social_worker');
    await screen.findByText('Pending Referrals');

    fireEvent.click(await screen.findByRole('button', { name: /Accept referral for Dela Cruz, Juan/ }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    const [path, opts] = mockNavigate.mock.calls[0];
    expect(path).toBe('/intake');
    expect(opts.state.sourceReferral).toEqual({
      type: 'barangay',
      id: 'r1',
      reason: 'Assistance needed',
    });
    expect(opts.state.prefill.firstName).toBe('Juan');
  });

  it('stays on the list when the accepted referral has no linked person', async () => {
    mockApiGet.mockResolvedValue([referral()]);
    mockApiPatch.mockResolvedValue(referral({ status: 'accepted' }));
    renderPage('social_worker');
    await screen.findByText('Pending Referrals');

    fireEvent.click(await screen.findByRole('button', { name: /Accept referral for Dela Cruz, Juan/ }));

    await waitFor(() => expect(mockApiPatch).toHaveBeenCalled());
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('offers Continue intake for accepted referrals that still have no case', async () => {
    mockApiGet.mockImplementation((url: string) =>
      Promise.resolve(
        String(url).includes('intakePending')
          ? [referral({ status: 'accepted', personId: 'person-1', caseId: null })]
          : [],
      ),
    );
    renderPage('social_worker');

    expect(await screen.findByText('Awaiting intake')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: /Continue intake for Dela Cruz, Juan/ }));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/intake',
      expect.objectContaining({
        state: expect.objectContaining({
          sourceReferral: expect.objectContaining({ type: 'barangay', id: 'r1' }),
        }),
      }),
    );
  });
});