import { describe, it, expect, beforeEach } from 'vitest';
import { loadQueue } from './offline-queue';

describe('Offline Queue', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loadQueue returns empty array when no queue exists', () => {
    const queue = loadQueue();
    expect(queue).toEqual([]);
  });

  it('loadQueue drops a corrupt blob instead of throwing', () => {
    // A truncated write must not take sync down: recover empty and clear it.
    localStorage.setItem('kapwa_sync_queue', '{"not":"json"');
    expect(() => loadQueue()).not.toThrow();
    expect(loadQueue()).toEqual([]);
    expect(localStorage.getItem('kapwa_sync_queue')).toBeNull();
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
