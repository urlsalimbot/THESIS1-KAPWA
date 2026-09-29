import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { axe } from 'vitest-axe';
import { MessagesPage } from './MessagesPage';

const { mockApiGet, mockApiPost } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
}));

vi.mock('../lib/chat-socket', () => ({
  connectSocket: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
  })),
  disconnectSocket: vi.fn(),
  sendMessage: vi.fn(),
  emitTyping: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: vi.fn(),
    del: vi.fn(),
  },
}));

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </SWRConfig>,
  );
}

describe('MessagesPage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    localStorage.setItem('kapwa_token', 'test-token');
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('conversations') || k.includes('list')) return Promise.resolve([]);
      if (k.includes('auth') && k.includes('me')) return Promise.resolve({ user: { id: 'me-id' } });
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('renders PageShell h1 heading', async () => {
    renderWithSWR(<MessagesPage />);
    const headings = await screen.findAllByRole('heading', { level: 1 });
    expect(headings.some(h => h.textContent === 'Messages')).toBe(true);
  });

  it('renders description text', async () => {
    renderWithSWR(<MessagesPage />);
    expect(await screen.findByText(/Chat with your team/i)).toBeTruthy();
  });

  it('renders New button', async () => {
    renderWithSWR(<MessagesPage />);
    expect(await screen.findByRole('button', { name: /New/i })).toBeTruthy();
  });

  it('disables New and says MSWDO staff will reach out when the contact list is empty', async () => {
    renderWithSWR(<MessagesPage />);
    const newBtn = await screen.findByRole('button', { name: /New/i });
    expect(newBtn).toBeDisabled();
    const hints = await screen.findAllByText(/MSWDO staff will message you/i);
    expect(hints.length).toBeGreaterThan(0);
  });

  it('enables New when chat contacts exist', async () => {
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('users')) return Promise.resolve([{ id: 'u9', fullName: 'Ate Glo', role: 'admin' }]);
      if (k.includes('conversations') || k.includes('list')) return Promise.resolve([]);
      return Promise.resolve(null);
    });
    renderWithSWR(<MessagesPage />);
    const newBtn = await screen.findByRole('button', { name: /New/i });
    await vi.waitFor(() => {
      expect(newBtn).not.toBeDisabled();
    });
  });

  it('has no a11y violations', async () => {
    const { container } = renderWithSWR(<MessagesPage />);
    const headings = await screen.findAllByRole('heading', { level: 1 });
    expect(headings.some(h => h.textContent === 'Messages')).toBe(true);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
