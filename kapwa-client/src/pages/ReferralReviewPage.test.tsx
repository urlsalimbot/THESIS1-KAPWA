import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReferralReviewPage } from './ReferralReviewPage';

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

function referral(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    personId: 'person-1',
    surname: 'Dela Cruz',
    firstName: 'Juan',
    barangay: 'Bigte',
    reason: 'Assistance needed',
    status: 'pending',
    createdAt: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ReferralReviewPage />
    </MemoryRouter>,
  );
}

describe('ReferralReviewPage', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiPatch.mockReset();
    mockNavigate.mockReset();
  });

  it('renders the pending queue with the full name schema', async () => {
    mockApiGet.mockResolvedValue([referral()]);
    renderPage();

    expect(await screen.findByText('Dela Cruz, Juan')).toBeTruthy();
    expect(mockApiGet).toHaveBeenCalledWith('/referrals?status=pending');
  });

  it('hands off to a pre-filled intake when a referral is accepted', async () => {
    mockApiGet.mockResolvedValue([referral()]);
    mockApiPatch.mockResolvedValue(referral({ status: 'accepted', caseId: null }));
    renderPage();
    await screen.findByText('Dela Cruz, Juan');

    fireEvent.click(screen.getByRole('button', { name: /Accept/ }));

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
    mockApiGet.mockResolvedValue([referral({ personId: null })]);
    mockApiPatch.mockResolvedValue(referral({ personId: null, status: 'accepted' }));
    renderPage();
    await screen.findByText('Dela Cruz, Juan');

    fireEvent.click(screen.getByRole('button', { name: /Accept/ }));

    await waitFor(() => expect(mockApiPatch).toHaveBeenCalled());
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
