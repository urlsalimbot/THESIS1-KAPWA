import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./encrypted-db', () => ({
  encryptedDb: {
    init: vi.fn().mockResolvedValue(undefined),
    getItem: vi.fn().mockImplementation(() => Promise.resolve(null)),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

import { encryptedDb } from './encrypted-db';
import { SecureStorage } from './secure-storage';

describe('SecureStorage — browser init (encrypted-db path)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('init() calls encryptedDb.init() exactly once', async () => {
    await SecureStorage.init();
    expect(encryptedDb.init).toHaveBeenCalledTimes(1);
  });

  it('init() succeeds when kapwa_db_key is present in localStorage', async () => {
    localStorage.setItem('kapwa_db_key', 'user-pass-123');
    await SecureStorage.init();
    expect(encryptedDb.init).toHaveBeenCalledTimes(1);
  });
});

describe('SecureStorage — corruption path + browser proxy', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('getItem() propagates the rejection when encryptedDb.getItem rejects (no try/catch at secure-storage.ts:71)', async () => {
    const syntaxError = new SyntaxError('malformed');
    (encryptedDb.getItem as ReturnType<typeof vi.fn>).mockRejectedValueOnce(syntaxError);
    await expect(SecureStorage.getItem('any-key')).rejects.toBe(syntaxError);
  });

  it('getItem / setItem / removeItem proxy to the corresponding encryptedDb methods', async () => {
    (encryptedDb.getItem as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ hello: 'world' } as never);
    const got = await SecureStorage.getItem('test-key');
    expect(got).toEqual({ hello: 'world' });
    expect(encryptedDb.getItem).toHaveBeenCalledWith('test-key');

    await SecureStorage.setItem('k', { a: 1 });
    expect(encryptedDb.setItem).toHaveBeenCalledWith('k', { a: 1 });

    await SecureStorage.removeItem('k');
    expect(encryptedDb.removeItem).toHaveBeenCalledWith('k');
  });
});
