import { describe, it, expect, beforeEach } from 'vitest';
import { queueChange, getPendingChanges, queueFsmTransition, loadQueue } from './offline-queue';

describe('offline-queue — queue', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('queueChange appends a pending change with a UUID and initial state', async () => {
    const c = await queueChange('cases', 'r1', 'UPDATE', { x: 1 });
    expect(c.id).toBeTruthy();
    expect(typeof c.id).toBe('string');
    expect(c.id.length).toBeGreaterThan(0);
    expect(c.status).toBe('pending');
    expect(c.serverVersion).toBe(0);
    expect(c.retryCount).toBe(0);
    expect(c.tableName).toBe('cases');
    expect(c.recordId).toBe('r1');
    expect(c.operation).toBe('UPDATE');
    expect(c.payload).toEqual({ x: 1 });
    expect(typeof c.clientUpdatedAt).toBe('string');
    expect(c.clientUpdatedAt.length).toBeGreaterThan(10);
  });

  it('queueChange auto-increments the local version vector for the table', async () => {
    await queueChange('cases', 'r1', 'UPDATE', {});
    await queueChange('cases', 'r2', 'UPDATE', {});
    const { getVersionVector } = await import('./offline-queue');
    const v = await getVersionVector('cases');
    expect(v?.localVersion).toBe(2);
  });

  it('getPendingChanges returns only status=pending entries', async () => {
    await queueChange('cases', 'r1', 'UPDATE', {});
    const c2 = await queueChange('cases', 'r2', 'UPDATE', {});
    const { markSynced } = await import('./offline-queue');
    await markSynced(c2.id, 1);
    const pending = await getPendingChanges();
    expect(pending).toHaveLength(1);
    expect(pending[0].recordId).toBe('r1');
  });

  it('getPendingChanges returns empty array when no queue', async () => {
    const pending = await getPendingChanges();
    expect(pending).toEqual([]);
  });

  it('queueFsmTransition writes status + _fsmTransition + _clientUpdatedAt and merges custom payload', async () => {
    const c = await queueFsmTransition('case-1', 'in_review', { notes: 'pre' });
    expect(c.payload.status).toBe('in_review');
    expect(c.payload._fsmTransition).toBe(true);
    expect(typeof c.payload._clientUpdatedAt).toBe('string');
    expect(c.payload.notes).toBe('pre');
  });

  it('loadQueue returns empty array when no queue exists', () => {
    const queue = loadQueue();
    expect(queue).toEqual([]);
  });

  it('loadQueue returns queued changes from localStorage', () => {
    const changes = [
      { id: '1', tableName: 'cases', operation: 'INSERT', status: 'pending' }
    ];
    localStorage.setItem('kapwa_sync_queue', JSON.stringify(changes));
    const queue = loadQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].status).toBe('pending');
  });
});
