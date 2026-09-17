import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { PayoutSchedulePage } from './PayoutSchedulePage';

const { mockApiGet, mockApiPatch, mockApiPost } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPatch: vi.fn(),
  mockApiPost: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    patch: (...args: unknown[]) => mockApiPatch(...args),
    del: vi.fn(),
  },
}));

function renderPage() {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
      <MemoryRouter initialEntries={['/cases/C-1/payouts']}>
        <Routes>
          <Route path="/cases/:caseId/payouts" element={<PayoutSchedulePage />} />
        </Routes>
      </MemoryRouter>
    </SWRConfig>,
  );
}

describe('PayoutSchedulePage', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiPatch.mockReset();
    mockApiPost.mockReset();
    mockApiPatch.mockResolvedValue({ id: 'p1' });
    mockApiPost.mockResolvedValue({ id: 'p1' });
  });

  it('lists payouts and marks one completed', async () => {
    mockApiGet.mockResolvedValue([
      { id: 'p1', scheduledAt: '2026-10-01', cycleNo: 'CY2026-02', amount: 1200, status: 'scheduled' },
    ]);
    renderPage();
    expect(await screen.findByText('CY2026-02')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Mark Completed/ }));
    await waitFor(() =>
      expect(mockApiPatch).toHaveBeenCalledWith('/fourps/payouts/p1/status', { status: 'completed' }),
    );
  });

  it('shows the empty state', async () => {
    mockApiGet.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('No payout schedules yet.')).toBeInTheDocument();
  });
});
