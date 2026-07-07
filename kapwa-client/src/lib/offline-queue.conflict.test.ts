import { describe, it, expect, beforeEach } from 'vitest';
import {
  mergeRecords,
  resolveConflict,
  markSynced,
  markConflict,
  markFailed,
  getConflictChanges,
  queueChange,
  loadQueue,
  getPendingChanges
} from './offline-queue';

describe('offline-queue — conflict resolution', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('mergeRecords server-wins for each FINANCIAL_FIELDS field', () => {
    for (const field of ['amount', 'status', 'fundSource', 'disbursedAmount']) {
      const result = mergeRecords({ [field]: 'server' }, { [field]: 'client' });
      expect(result[field]).toBe('server');
    }
  });

  it('mergeRecords notes: appends with newline when both present, keeps server when client empty', () => {
    expect(mergeRecords({ notes: 'A' }, { notes: 'B' })).toEqual({ notes: 'A\nB' });
    expect(mergeRecords({ notes: 'A' }, {})).toEqual({ notes: 'A' });
  });

  it('mergeRecords consentStatus: server revoked overrides client; no override when server not revoked', () => {
    expect(mergeRecords({ consentStatus: 'revoked' }, { consentStatus: 'active' })).toEqual({ consentStatus: 'revoked' });
    expect(mergeRecords({ consentStatus: 'active' }, { consentStatus: 'pending' })).toEqual({ consentStatus: 'pending' });
  });

  it('markSynced transitions pending to synced, updates serverVersion, and preserves non-zero on smaller overwrite', async () => {
    const c = await queueChange('cases', 'r1', 'UPDATE', {});
    await markSynced(c.id, 5);
    expect(await getPendingChanges()).toHaveLength(0);
    const stored1 = loadQueue().find((x) => x.id === c.id)!;
    expect(stored1.status).toBe('synced');
    expect(stored1.serverVersion).toBe(5);

    await markSynced(c.id, 3);
    const stored2 = loadQueue().find((x) => x.id === c.id)!;
    expect(stored2.serverVersion).toBe(5);
  });

  it('markConflict transitions pending to conflict, bumps retryCount, sets lastError, and surfaces in getConflictChanges', async () => {
    const c = await queueChange('cases', 'r1', 'UPDATE', {});
    await markConflict(c.id, 'version mismatch');
    const stored = loadQueue().find((x) => x.id === c.id)!;
    expect(stored.status).toBe('conflict');
    expect(stored.retryCount).toBe(1);
    expect(stored.lastError).toBe('version mismatch');
    const conflicts = await getConflictChanges();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].recordId).toBe('r1');
  });

  it('markFailed transitions pending to failed, sets lastError, and does not bump retryCount', async () => {
    const c = await queueChange('cases', 'r1', 'UPDATE', {});
    await markFailed(c.id, 'http 500');
    const stored = loadQueue().find((x) => x.id === c.id)!;
    expect(stored.status).toBe('failed');
    expect(stored.retryCount).toBe(0);
    expect(stored.lastError).toBe('http 500');
  });

  it('resolveConflict server-wins: server fields override client; client-only fields preserved', () => {
    expect(resolveConflict('server-wins', { a: 1, b: 2 }, { a: 99, c: 3 })).toEqual({ a: 1, b: 2, c: 3 });
  });

  it('resolveConflict client-wins: delegates to mergeRecords (FINANCIAL_FIELDS still server-wins, client notes preserved)', () => {
    expect(resolveConflict('client-wins', { amount: 100 }, { amount: 200, notes: 'x' })).toEqual({ amount: 100, notes: 'x' });
  });

  it('getConflictChanges returns only status=conflict entries', async () => {
    await queueChange('cases', 'r1', 'UPDATE', {});
    const c2 = await queueChange('cases', 'r2', 'UPDATE', {});
    await markConflict(c2.id, 'version mismatch');
    const conflicts = await getConflictChanges();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].recordId).toBe('r2');
  });

  it('getConflictChanges returns empty array when no queue', async () => {
    expect(await getConflictChanges()).toEqual([]);
  });
});
