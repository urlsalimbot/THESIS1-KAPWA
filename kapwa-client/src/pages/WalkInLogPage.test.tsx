import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { WalkInLogPage } from './WalkInLogPage';

const { mockGet, mockPost, mockPatch } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPatch: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
  },
}));

function renderPage() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <MemoryRouter><WalkInLogPage /></MemoryRouter>
    </SWRConfig>,
  );
}

describe('WalkInLogPage', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockPatch.mockReset();
    mockGet.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    mockPost.mockResolvedValue({ id: 'w1', queueNo: 1 });
    mockPatch.mockResolvedValue({});
  });

  it('logs a walk-in with name and purpose from the quick-add form', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Last name'), 'Reyes');
    await user.type(screen.getByLabelText('First name'), 'Pedro');
    await user.type(screen.getByLabelText('Purpose details'), 'Medical bill');
    await user.click(screen.getByRole('button', { name: /log visit/i }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/walk-in-logs', expect.objectContaining({
      firstName: 'Pedro',
      lastName: 'Reyes',
      purposeCode: 'inquiry',
      purposeText: 'Medical bill',
    })));
  });

  it('shows the visit columns and empty state', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: /walk-in log/i })).toBeTruthy();
    expect(screen.getByText('No visits for this filter.')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /reports/i })).toBeTruthy();
  });
});
