import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MessagesPage } from './MessagesPage';

// Mock chat socket
vi.mock('../lib/chat-socket', () => ({
  connectSocket: vi.fn(() => ({
    on: vi.fn(),
  })),
  disconnectSocket: vi.fn(),
  sendMessage: vi.fn(),
  emitTyping: vi.fn(),
}));

describe('MessagesPage', () => {
  beforeEach(() => {
    localStorage.setItem('kapwa_token', 'test-token');
  });

  it('renders PageShell h1 heading', async () => {
    render(<MemoryRouter><MessagesPage /></MemoryRouter>);
    const headings = await screen.findAllByRole('heading', { level: 1 });
    expect(headings.some(h => h.textContent === 'Messages')).toBe(true);
  });

  it('renders description text', async () => {
    render(<MemoryRouter><MessagesPage /></MemoryRouter>);
    expect(await screen.findByText(/Chat with other MSWDO team members/i)).toBeTruthy();
  });

  it('renders New button', async () => {
    render(<MemoryRouter><MessagesPage /></MemoryRouter>);
    expect(await screen.findByRole('button', { name: /\+ New/i })).toBeTruthy();
  });
});
