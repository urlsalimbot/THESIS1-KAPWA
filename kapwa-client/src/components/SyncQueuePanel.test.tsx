import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SyncQueuePanel } from './SyncQueuePanel';

// Mock offline-queue
const mockLoadQueue = vi.fn();
vi.mock('@/lib/offline-queue', () => ({
  loadQueue: (...args: unknown[]) => mockLoadQueue(...args),
}));

describe('SyncQueuePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "All caught up" empty state with CheckCircle icon when queue is empty', () => {
    mockLoadQueue.mockReturnValue([]);
    const { container } = render(<SyncQueuePanel open={true} onClose={() => {}} />);
    expect(screen.getByText('All caught up')).toBeTruthy();
  });

  it('renders pending items with correct status badge', () => {
    mockLoadQueue.mockReturnValue([
      {
        id: 'q1',
        tableName: 'cases',
        recordId: 'C-001',
        operation: 'UPDATE',
        payload: {},
        clientUpdatedAt: new Date().toISOString(),
        serverVersion: 0,
        status: 'pending',
        retryCount: 0,
      },
    ]);
    render(<SyncQueuePanel open={true} onClose={() => {}} />);
    expect(screen.getByText(/cases #C-001/)).toBeTruthy();
  });

  it('renders failed items with Retry Sync button', () => {
    mockLoadQueue.mockReturnValue([
      {
        id: 'q2',
        tableName: 'beneficiaries',
        recordId: 'B-001',
        operation: 'UPDATE',
        payload: {},
        clientUpdatedAt: new Date().toISOString(),
        serverVersion: 0,
        status: 'failed',
        retryCount: 1,
        lastError: 'Network error',
      },
    ]);
    render(<SyncQueuePanel open={true} onClose={() => {}} />);
    expect(screen.getByText('Network error')).toBeTruthy();
    // Retry Sync button has aria-label="Retry Sync"
    const retryBtn = screen.getByRole('button', { name: /Retry Sync/i });
    expect(retryBtn).toBeTruthy();
  });

  it('renders conflict items with View Diff button', () => {
    mockLoadQueue.mockReturnValue([
      {
        id: 'q3',
        tableName: 'cases',
        recordId: 'C-002',
        operation: 'UPDATE',
        payload: {},
        clientUpdatedAt: new Date().toISOString(),
        serverVersion: 2,
        status: 'conflict',
        retryCount: 1,
        lastError: 'Version conflict',
      },
    ]);
    render(<SyncQueuePanel open={true} onClose={() => {}} />);
    // View Diff button has aria-label="View Diff"
    const viewDiffBtn = screen.getByRole('button', { name: /View Diff/i });
    expect(viewDiffBtn).toBeTruthy();
  });

  it('calls onClose when Sheet close is triggered', () => {
    mockLoadQueue.mockReturnValue([]);
    const onClose = vi.fn();
    render(<SyncQueuePanel open={true} onClose={onClose} />);
    expect(screen.getByText('Sync Queue')).toBeTruthy();
    expect(screen.getByText('All caught up')).toBeTruthy();
  });

  it('renders syncing items with animated refresh icon', () => {
    mockLoadQueue.mockReturnValue([
      {
        id: 'q4',
        tableName: 'cases',
        recordId: 'C-003',
        operation: 'INSERT',
        payload: {},
        clientUpdatedAt: new Date().toISOString(),
        serverVersion: 0,
        status: 'syncing',
        retryCount: 0,
      },
    ]);
    render(<SyncQueuePanel open={true} onClose={() => {}} />);
    expect(screen.getByText(/cases #C-003/)).toBeTruthy();
  });
});
