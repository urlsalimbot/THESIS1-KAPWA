import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { ContactMessagesPanel } from './ContactMessagesPanel';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));

vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
  },
}));

function renderPanel() {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
      <ContactMessagesPanel />
    </SWRConfig>,
  );
}

describe('ContactMessagesPanel', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
  });

  it('fetches the inbox from /contact-messages, not a nested chat path', async () => {
    mockApiGet.mockResolvedValue([
      { id: 'm1', name: 'Jane Cruz', email: 'jane@example.com', subject: null, message: 'Hello', status: 'new', createdAt: '2026-10-01T00:00:00Z' },
    ]);

    renderPanel();

    expect(await screen.findByText('Jane Cruz')).toBeInTheDocument();
    // The key must normalize to `/contact-messages`; `['chat','contact-messages']`
    // produced `/chat/contact-messages`, which 404s and left the tab empty.
    const keys = mockApiGet.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(keys.some((k) => k === JSON.stringify(['contact-messages']))).toBe(true);
  });

  it('shows the empty state when there are no inquiries', async () => {
    mockApiGet.mockResolvedValue([]);
    renderPanel();
    expect(await screen.findByText('No inquiries yet')).toBeInTheDocument();
  });
});
