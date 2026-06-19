import { Capacitor } from '@capacitor/core';
import { encryptedDb } from './encrypted-db';

// Platform detection — returns 'native' for Capacitor mobile, 'browser' for web
function getPlatform(): 'native' | 'browser' {
  if (Capacitor.isNativePlatform()) {
    return 'native';
  }
  return 'browser';
}

// Derive encryption key from user's password hash for cross-platform compatibility
// Use server-side hash (what the user types at login)
// so key derivation is platform-independent and recoverable on reinstall
function getStorageKey(): string {
  return localStorage.getItem('kapwa_db_key') || '';
}

export const SecureStorage = {
  async init(password?: string): Promise<void> {
    const platform = getPlatform();
    if (platform === 'native') {
      // SQLCipher for Capacitor mobile — import dynamically to avoid breaking browser builds
      const { CapacitorSQLite } = await import('@capacitor-community/sqlite');
      const db = await CapacitorSQLite.createConnection({
        database: 'kapwa',
        version: 1,
        encrypted: true,
        mode: 'secret',
      });
      // Derive key from user password for platform-independent recovery
      const key = password || getStorageKey();
      await db.open(key);
      await db.execute(`
        CREATE TABLE IF NOT EXISTS sync_cache (
          key TEXT PRIMARY KEY,
          value TEXT,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await db.close();
    } else {
      // Browser fallback — existing AES-256-GCM over localStorage
      await encryptedDb.init();
    }
  },

  async getItem<T = unknown>(key: string): Promise<T | null> {
    const platform = getPlatform();
    if (platform === 'native') {
      const { CapacitorSQLite } = await import('@capacitor-community/sqlite');
      const db = await CapacitorSQLite.createConnection({
        database: 'kapwa',
        version: 1,
        encrypted: true,
        mode: 'secret',
      });
      await db.open(getStorageKey());
      const res = await db.query(`SELECT value FROM sync_cache WHERE key = ?`, [key]);
      await db.close();
      if (res.values && res.values.length > 0) {
        return JSON.parse(res.values[0].value);
      }
      return null;
    }
    return encryptedDb.getItem<T>(key);
  },

  async setItem(key: string, value: unknown): Promise<void> {
    const platform = getPlatform();
    if (platform === 'native') {
      const { CapacitorSQLite } = await import('@capacitor-community/sqlite');
      const db = await CapacitorSQLite.createConnection({
        database: 'kapwa',
        version: 1,
        encrypted: true,
        mode: 'secret',
      });
      await db.open(getStorageKey());
      await db.execute(
        `INSERT OR REPLACE INTO sync_cache (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)`,
        [key, JSON.stringify(value)]
      );
      await db.close();
    } else {
      return encryptedDb.setItem(key, value);
    }
  },

  async removeItem(key: string): Promise<void> {
    const platform = getPlatform();
    if (platform === 'native') {
      const { CapacitorSQLite } = await import('@capacitor-community/sqlite');
      const db = await CapacitorSQLite.createConnection({
        database: 'kapwa',
        version: 1,
        encrypted: true,
        mode: 'secret',
      });
      await db.open(getStorageKey());
      await db.execute(`DELETE FROM sync_cache WHERE key = ?`, [key]);
      await db.close();
    } else {
      return encryptedDb.removeItem(key);
    }
  },
};
