import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConflictResolutionDialog } from './ConflictResolutionDialog';

// Mock offline-queue
vi.mock('@/lib/offline-queue', () => ({
  loadQueue: vi.fn(() => []),
}));

describe('ConflictResolutionDialog', () => {
  const conflictItem = {
    id: 'conflict-1',
    tableName: 'cases',
    recordId: 'C-001',
    operation: 'UPDATE' as const,
    payload: { status: 'approved', amount: 5000 },
    clientUpdatedAt: new Date().toISOString(),
    serverVersion: 3,
    status: 'conflict' as const,
    retryCount: 1,
    lastError: 'Version conflict',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog with conflict title showing tableName and recordId', () => {
    render(
      <ConflictResolutionDialog
        item={conflictItem}
        open={true}
        onOpenChange={() => {}}
      />
    );
    expect(screen.getByText(/Sync Conflict/)).toBeTruthy();
    expect(screen.getByText(/cases #C-001/)).toBeTruthy();
  });

  it('shows both Local and Server column headings', () => {
    render(
      <ConflictResolutionDialog
        item={conflictItem}
        open={true}
        onOpenChange={() => {}}
      />
    );
    expect(screen.getByText(/Local.*Your Changes/)).toBeTruthy();
    // Server heading is an h4 element
    const headings = screen.getAllByText('Server');
    expect(headings.length).toBeGreaterThanOrEqual(1);
  });

  it('renders Keep Local, Keep Server, and Keep Both buttons', () => {
    render(
      <ConflictResolutionDialog
        item={conflictItem}
        open={true}
        onOpenChange={() => {}}
      />
    );
    expect(screen.getByText('Keep Local')).toBeTruthy();
    expect(screen.getByText('Keep Server')).toBeTruthy();
    expect(screen.getByText('Keep Both')).toBeTruthy();
  });
});
