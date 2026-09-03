import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { NotificationsPage } from './NotificationsPage';

const { mockApiGet, mockApiPost, mockNavigate } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock('../lib/notification-socket', () => ({
  connectNotificationSocket: vi.fn(() => ({ on: vi.fn(), off: vi.fn() })),
  disconnectNotificationSocket: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

interface Notification {
  id: string;
  title: string;
  message: string;
  category: string;
  isRead: boolean;
  createdAt: string;
  referenceId?: string;
}

function notif(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n1',
    title: 'SLA Alert',
    message: 'Case exceeded SLA',
    category: 'sla_escalation',
    isRead: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </SWRConfig>,
  );
}

describe('NotificationsPage SLA escalation navigation', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockNavigate.mockReset();
    localStorage.setItem('kapwa_token', 'test-token');
    mockApiGet.mockImplementation((...args: unknown[]) => {
      const k = JSON.stringify(args);
      if (k.includes('notifications') && k.includes('my')) return Promise.resolve([notif()]);
      if (k.includes('notifications') && k.includes('unread')) return Promise.resolve({ count: 1 });
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('navigates to the case when an sla_escalation notification with a referenceId is clicked', async () => {
    mockApiGet.mockImplementation((...args: unknown[]) => {
      const k = JSON.stringify(args);
      if (k.includes('notifications') && k.includes('my')) {
        return Promise.resolve([notif({ referenceId: 'case-1' })]);
      }
      if (k.includes('notifications') && k.includes('unread')) return Promise.resolve({ count: 1 });
      return Promise.resolve(null);
    });
    renderWithSWR(<NotificationsPage />);
    const title = await screen.findByText('SLA Alert');
    fireEvent.click(title.closest('button')!);
    expect(mockNavigate).toHaveBeenCalledWith('/cases/case-1');
  });

  it('navigates to /cases when an sla_escalation notification has no referenceId', async () => {
    renderWithSWR(<NotificationsPage />);
    const title = await screen.findByText('SLA Alert');
    fireEvent.click(title.closest('button')!);
    expect(mockNavigate).toHaveBeenCalledWith('/cases');
  });
});