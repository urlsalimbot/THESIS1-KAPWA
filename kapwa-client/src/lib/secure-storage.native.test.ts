import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Capacitor } from '@capacitor/core';

vi.mock('@capacitor-community/sqlite', () => ({
  CapacitorSQLite: {
    createConnection: vi.fn().mockResolvedValue(undefined),
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue({ values: [] }),
    execute: vi.fn().mockResolvedValue({ changes: 1 }),
  },
}));

import { SecureStorage } from './secure-storage';

describe('SecureStorage — native path (SQLCipher)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('init() calls createConnection + open + execute + close in order with encrypted: true and mode: secret', async () => {
    const { CapacitorSQLite } = await import('@capacitor-community/sqlite');
    await SecureStorage.init('user-pass');
    expect(Capacitor.isNativePlatform()).toBe(true);
    expect(CapacitorSQLite.createConnection).toHaveBeenCalledWith(
      expect.objectContaining({ database: 'kapwa', encrypted: true, mode: 'secret' }),
    );
    expect(CapacitorSQLite.open).toHaveBeenCalled();
    expect(CapacitorSQLite.execute).toHaveBeenCalledWith(
      expect.objectContaining({ database: 'kapwa' }),
    );
    expect(CapacitorSQLite.close).toHaveBeenCalled();
    const order = [
      (CapacitorSQLite.createConnection as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
      (CapacitorSQLite.open as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
      (CapacitorSQLite.execute as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
      (CapacitorSQLite.close as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
    ];
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('getItem() returns the JSON-parsed value from the query result', async () => {
    const { CapacitorSQLite } = await import('@capacitor-community/sqlite');
    (CapacitorSQLite.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      values: [{ value: JSON.stringify({ foo: 'bar' }) }],
    });
    const val = await SecureStorage.getItem<{ foo: string }>('test-key');
    expect(val).toEqual({ foo: 'bar' });
    expect(CapacitorSQLite.open).toHaveBeenCalled();
    expect(CapacitorSQLite.query).toHaveBeenCalled();
    expect(CapacitorSQLite.close).toHaveBeenCalled();
  });

  it('getItem() returns null when the query result has no rows', async () => {
    const { CapacitorSQLite } = await import('@capacitor-community/sqlite');
    (CapacitorSQLite.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ values: [] });
    expect(await SecureStorage.getItem('missing')).toBeNull();
  });

  it('setItem() executes an INSERT OR REPLACE INTO sync_cache with the JSON-stringified value', async () => {
    const { CapacitorSQLite } = await import('@capacitor-community/sqlite');
    await SecureStorage.setItem('k', { a: 1 });
    expect(CapacitorSQLite.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        statement: expect.stringContaining('INSERT OR REPLACE INTO sync_cache'),
        values: ['k', JSON.stringify({ a: 1 })],
      }),
    );
  });

  it('removeItem() executes a DELETE FROM sync_cache with the key as the value', async () => {
    const { CapacitorSQLite } = await import('@capacitor-community/sqlite');
    await SecureStorage.removeItem('k');
    expect(CapacitorSQLite.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        statement: expect.stringContaining('DELETE FROM sync_cache'),
        values: ['k'],
      }),
    );
  });
});
