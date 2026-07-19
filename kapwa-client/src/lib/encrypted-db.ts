const STORAGE_KEY = 'kapwa_encrypted_v2';
const PBKDF2_ITERATIONS = 600000;
const MAX_ENCRYPTION_RETRIES = 3;

function canUseCrypto(): boolean {
  return typeof crypto?.subtle?.encrypt === 'function' && typeof localStorage !== 'undefined';
}

function safeLocalStorage(): Storage | null {
  try {
    const test = '__test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return localStorage;
  } catch {
    return null;
  }
}

async function deriveKey(passphrase: string, salt: ArrayBuffer): Promise<CryptoKey | null> {
  try {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  } catch (e) {
    console.warn('[encrypted-db] Key derivation failed:', e);
    return null;
  }
}

async function encrypt(plaintext: string, passphrase: string): Promise<string | null> {
  try {
    const salt = crypto.getRandomValues(new Uint8Array(16)).buffer as ArrayBuffer;
    const iv = crypto.getRandomValues(new Uint8Array(12)).buffer as ArrayBuffer;
    const key = await deriveKey(passphrase, salt);
    if (!key) return null;
    const enc = new TextEncoder();
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, key, enc.encode(plaintext)
    );
    const combined = new Uint8Array(salt.byteLength + iv.byteLength + ciphertext.byteLength);
    combined.set(new Uint8Array(salt), 0);
    combined.set(new Uint8Array(iv), salt.byteLength);
    combined.set(new Uint8Array(ciphertext), salt.byteLength + iv.byteLength);
    return btoa(String.fromCharCode(...combined));
  } catch (e) {
    console.warn('[encrypted-db] Encryption failed:', e);
    return null;
  }
}

async function decrypt(data: string, passphrase: string): Promise<string | null> {
  try {
    const combined = Uint8Array.from(atob(data), c => c.charCodeAt(0));
    const salt = combined.subarray(0, 16).buffer as ArrayBuffer;
    const iv = combined.subarray(16, 28).buffer as ArrayBuffer;
    const ciphertext = combined.subarray(28);
    const key = await deriveKey(passphrase, salt);
    if (!key) return null;
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    console.warn('[encrypted-db] Decryption failed:', e);
    return null;
  }
}

function getPassphrase(): string | null {
  const ls = safeLocalStorage();
  if (!ls) return null;
  try {
    let pass = ls.getItem('kapwa_db_key');
    if (!pass) {
      pass = crypto.randomUUID() + '-' + crypto.randomUUID();
      ls.setItem('kapwa_db_key', pass);
    }
    return pass;
  } catch {
    return null;
  }
}

function memoryStore(): Record<string, unknown> {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : {};
}

function saveMemoryStore(store: Record<string, unknown>): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export const encryptedDb = {
  async init(): Promise<void> {
    if (!canUseCrypto()) {
      console.warn('[encrypted-db] Web Crypto or localStorage not available — using sessionStorage fallback');
      return;
    }
    const ls = safeLocalStorage();
    if (!ls) return;
    const raw = ls.getItem(STORAGE_KEY);
    if (!raw) {
      const pass = getPassphrase();
      if (!pass) return;
      const encrypted = await encrypt(JSON.stringify({}), pass);
      if (encrypted) ls.setItem(STORAGE_KEY, encrypted);
    }
  },

  async getItem<T = unknown>(key: string): Promise<T | null> {
    if (!canUseCrypto()) {
      const store = memoryStore();
      return (store[key] as T) ?? null;
    }
    const ls = safeLocalStorage();
    if (!ls) return null;
    try {
      const pass = getPassphrase();
      if (!pass) return null;
      const raw = ls.getItem(STORAGE_KEY);
      if (!raw) return null;
      const decrypted = await decrypt(raw, pass);
      if (!decrypted) return null;
      const store = JSON.parse(decrypted);
      return store[key] ?? null;
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: unknown): Promise<void> {
    if (!canUseCrypto()) {
      const store = memoryStore();
      store[key] = value;
      saveMemoryStore(store);
      return;
    }
    const ls = safeLocalStorage();
    if (!ls) return;
    const pass = getPassphrase();
    if (!pass) return;

    for (let attempt = 0; attempt < MAX_ENCRYPTION_RETRIES; attempt++) {
      try {
        const raw = ls.getItem(STORAGE_KEY);
        const decrypted = raw ? await decrypt(raw, pass) : null;
        const store = decrypted ? JSON.parse(decrypted) : {};
        store[key] = value;
        const encrypted = await encrypt(JSON.stringify(store), pass);
        if (encrypted) {
          ls.setItem(STORAGE_KEY, encrypted);
          return;
        }
      } catch {
        if (attempt === MAX_ENCRYPTION_RETRIES - 1) {
          console.warn('[encrypted-db] setItem failed after', MAX_ENCRYPTION_RETRIES, 'attempts');
        }
      }
    }
  },

  async removeItem(key: string): Promise<void> {
    if (!canUseCrypto()) {
      const store = memoryStore();
      delete store[key];
      saveMemoryStore(store);
      return;
    }
    const ls = safeLocalStorage();
    if (!ls) return;
    try {
      const pass = getPassphrase();
      if (!pass) return;
      const raw = ls.getItem(STORAGE_KEY);
      if (!raw) return;
      const decrypted = await decrypt(raw, pass);
      if (!decrypted) return;
      const store = JSON.parse(decrypted);
      delete store[key];
      const encrypted = await encrypt(JSON.stringify(store), pass);
      if (encrypted) ls.setItem(STORAGE_KEY, encrypted);
    } catch {
      console.warn('[encrypted-db] removeItem failed');
    }
  },
};
