import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuickScanCard } from './QuickScanCard';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
  },
}));

const summaryPayload = {
  cardCode: 'NORZ-AC-2026-0001',
  person: { id: 'p1', firstName: 'Maria', surname: 'Santos' },
  servicesRendered: [],
  servicesFromOtherAgencies: [],
  referralHistory: [],
  sharingConsentActive: true,
};

function hangUntilResolved() {
  const holder: { resolve?: (value: unknown) => void; reject?: (reason: unknown) => void } = {};
  mockApiGet.mockImplementation(() => new Promise((res, rej) => { holder.resolve = res; holder.reject = rej; }));
  return holder;
}

describe('QuickScanCard', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
  });

  it('verifies an access card code and shows the beneficiary', async () => {
    mockApiGet.mockResolvedValue(summaryPayload);
    const user = userEvent.setup();
    render(<QuickScanCard />);
    await user.type(screen.getByLabelText(/access card code/i), 'NORZ-AC-2026-0001');
    await user.click(screen.getByRole('button', { name: 'Verify Card' }));
    expect(await screen.findByText(/Maria Santos/)).toBeTruthy();
  });

  it('disables verify while a request is in flight', async () => {
    const holder = hangUntilResolved();
    const user = userEvent.setup();
    render(<QuickScanCard />);
    await user.type(screen.getByLabelText(/access card code/i), 'NORZ-AC-2026-0001');
    const button = screen.getByRole('button', { name: 'Verify Card' });
    await user.click(button);
    expect(button).toBeDisabled();
    holder.resolve!(summaryPayload);
    await waitFor(() => expect(button).toBeEnabled());
  });

  it('does not fire a second request while a request is in flight', async () => {
    const holder = hangUntilResolved();
    const user = userEvent.setup();
    render(<QuickScanCard />);
    const input = screen.getByLabelText(/access card code/i);
    await user.type(input, 'NORZ-AC-2026-0001');
    await user.keyboard('{Enter}');
    await user.keyboard('{Enter}');
    expect(mockApiGet).toHaveBeenCalledTimes(1);
    holder.resolve!(summaryPayload);
    await waitFor(() => expect(screen.getByText(/Maria Santos/)).toBeTruthy());
  });

  it('re-enables verify after a failed request', async () => {
    const holder = hangUntilResolved();
    const user = userEvent.setup();
    render(<QuickScanCard />);
    await user.type(screen.getByLabelText(/access card code/i), 'NORZ-AC-2026-9999');
    const button = screen.getByRole('button', { name: 'Verify Card' });
    await user.click(button);
    expect(button).toBeDisabled();
    holder.reject!(new Error('not found'));
    await waitFor(() => expect(button).toBeEnabled());
    expect(await screen.findByText(/Card not found/)).toBeTruthy();
  });
});
