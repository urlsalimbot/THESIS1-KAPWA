import { describe, it, expect, beforeEach } from 'vitest';
import {
  incrementLocalVersion,
  updateServerVersion,
  getVersionVector,
  getAllVersionVectors
} from './offline-queue';

describe('offline-queue — version vectors', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('incrementLocalVersion starts a new table at localVersion=1 with serverVersion=0 and lastSyncedAt=null', async () => {
    await incrementLocalVersion('cases');
    const v = await getVersionVector('cases');
    expect(v).toEqual({ tableName: 'cases', localVersion: 1, serverVersion: 0, lastSyncedAt: null });
  });

  it('incrementLocalVersion increments an existing table (3x yields 3)', async () => {
    await incrementLocalVersion('cases');
    await incrementLocalVersion('cases');
    await incrementLocalVersion('cases');
    const v = await getVersionVector('cases');
    expect(v?.localVersion).toBe(3);
  });

  it('incrementLocalVersion is per-table (cases and interventions isolated)', async () => {
    await incrementLocalVersion('cases');
    await incrementLocalVersion('interventions');
    expect((await getVersionVector('cases'))?.localVersion).toBe(1);
    expect((await getVersionVector('interventions'))?.localVersion).toBe(1);
  });

  it('updateServerVersion starts a new table at localVersion=0 with the given server version and sets lastSyncedAt', async () => {
    await updateServerVersion('cases', 7);
    const v = await getVersionVector('cases');
    expect(v?.tableName).toBe('cases');
    expect(v?.localVersion).toBe(0);
    expect(v?.serverVersion).toBe(7);
    expect(v?.lastSyncedAt).not.toBeNull();
    expect(typeof v?.lastSyncedAt).toBe('string');
  });

  it('updateServerVersion overwrites an existing vector and updates lastSyncedAt', async () => {
    await updateServerVersion('cases', 5);
    await updateServerVersion('cases', 10);
    const v = await getVersionVector('cases');
    expect(v?.serverVersion).toBe(10);
    expect(v?.lastSyncedAt).not.toBeNull();
  });

  it('getVersionVector returns the single matching vector', async () => {
    await updateServerVersion('cases', 5);
    const v = await getVersionVector('cases');
    expect(v).toBeDefined();
    expect(v?.tableName).toBe('cases');
    expect(v?.serverVersion).toBe(5);
  });

  it('getVersionVector returns undefined for an unknown table', async () => {
    const v = await getVersionVector('unknown');
    expect(v).toBeUndefined();
  });

  it('getAllVersionVectors returns the full list (or empty when none)', async () => {
    await incrementLocalVersion('cases');
    await incrementLocalVersion('interventions');
    const all = await getAllVersionVectors();
    expect(all).toHaveLength(2);
    expect(all.map((v) => v.tableName).sort()).toEqual(['cases', 'interventions']);

    localStorage.clear();
    expect(await getAllVersionVectors()).toEqual([]);
  });
});
