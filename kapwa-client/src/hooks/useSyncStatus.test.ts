import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { useSyncStatus } from './useSyncStatus';

vi.mock('../lib/offline-queue', () => ({
  loadQueue: vi.fn(() => [{ id: '1', status: 'pending' }]),
}));

describe('useSyncStatus', () => {
  it('reports pending change count from the offline queue', async () => {
    const { result } = renderHook(() => useSyncStatus());
    await waitFor(() => {
      expect(result.current.pending).toBeGreaterThan(0);
    });
  });
});
