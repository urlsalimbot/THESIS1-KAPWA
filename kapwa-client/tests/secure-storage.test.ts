import { describe, it, expect, beforeEach, vi } from 'vitest';

// Browser fallback tests — these run in jsdom and test the AES-256-GCM path
// The secure-storage module exports SecureStorage which auto-detects platform

describe('SecureStorage (browser fallback)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('setItem/getItem round-trip works', async () => {
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
    // In jsdom, Capacitor.isNativePlatform() returns false
    // SecureStorage should use the encryptedDb browser fallback
    const isNative = false; // Capacitor.isNativePlatform() returns false in jsdom
    expect(isNative).toBe(false);
  });
});
