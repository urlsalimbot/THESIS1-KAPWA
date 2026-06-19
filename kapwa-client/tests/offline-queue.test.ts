import { describe, it, expect, beforeEach } from 'vitest';
import { loadQueue } from '../src/lib/offline-queue';

describe('Offline Queue', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loadQueue returns empty array when no queue exists', () => {
    const queue = loadQueue();
    expect(queue).toEqual([]);
  });

  it('loadQueue returns queued changes', () => {
    const changes = [
      { id: '1', tableName: 'cases', operation: 'INSERT', status: 'pending' }
    ];
    localStorage.setItem('kapwa_sync_queue', JSON.stringify(changes));
    const queue = loadQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].status).toBe('pending');
  });
});
