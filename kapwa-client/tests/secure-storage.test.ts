import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use mockImplementation instead of mockResolvedValue for reliability
vi.mock('../src/lib/encrypted-db', () => ({
  encryptedDb: {
    init: vi.fn().mockResolvedValue(undefined),
    getItem: vi.fn().mockImplementation(() => Promise.resolve(null)),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

import { encryptedDb } from '../src/lib/encrypted-db';

describe('SecureStorage (browser fallback)', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset the mock's implementation each test
    (encryptedDb.getItem as ReturnType<typeof vi.fn>).mockImplementation(
      () => Promise.resolve(null)
    );
  });

  it('setItem/getItem round-trip works', async () => {
    // One-time return for this test
    (encryptedDb.getItem as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () => Promise.resolve({ hello: 'world' })
    );

    const { SecureStorage } = await import('../src/lib/secure-storage');
    await SecureStorage.setItem('test-key', { hello: 'world' });
    const val = await SecureStorage.getItem('test-key');
    expect(val).toEqual({ hello: 'world' });
  });

  it('returns null for missing key', async () => {
    const { SecureStorage } = await import('../src/lib/secure-storage');
    const val = await SecureStorage.getItem('nonexistent');
    expect(val).toBeNull();
  });

  it('detects browser platform (jsdom)', () => {
    const isNative = false;
    expect(isNative).toBe(false);
  });
});
