const STORAGE_KEY = 'kapwa_encrypted_v2';
const PBKDF2_ITERATIONS = 600000;

async function deriveKey(passphrase: string, salt: ArrayBuffer): Promise<CryptoKey> {
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
}

async function encrypt(plaintext: string, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16)).buffer as ArrayBuffer;
  const iv = crypto.getRandomValues(new Uint8Array(12)).buffer as ArrayBuffer;
  const key = await deriveKey(passphrase, salt);
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );
  const combined = new Uint8Array(salt.byteLength + iv.byteLength + ciphertext.byteLength);
  combined.set(new Uint8Array(salt), 0);
  combined.set(new Uint8Array(iv), salt.byteLength);
  combined.set(new Uint8Array(ciphertext), salt.byteLength + iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(data: string, passphrase: string): Promise<string> {
  const combined = Uint8Array.from(atob(data), c => c.charCodeAt(0));
  const salt = combined.subarray(0, 16).buffer as ArrayBuffer;
  const iv = combined.subarray(16, 28).buffer as ArrayBuffer;
  const ciphertext = combined.subarray(28);
  const key = await deriveKey(passphrase, salt);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

function getPassphrase(): string {
  let pass = localStorage.getItem('kapwa_db_key');
  if (!pass) {
    pass = crypto.randomUUID() + '-' + crypto.randomUUID();
    localStorage.setItem('kapwa_db_key', pass);
  }
  return pass;
}

export const encryptedDb = {
  async init(): Promise<void> {
    if (typeof crypto?.subtle?.encrypt !== 'function') {
      console.warn('[encrypted-db] Web Crypto not available — using plain localStorage fallback');
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const pass = getPassphrase();
      await encrypt(JSON.stringify({}), pass);
      localStorage.setItem(STORAGE_KEY, await encrypt(JSON.stringify({}), pass));
    }
  },

  async getItem<T = unknown>(key: string): Promise<T | null> {
    try {
      const pass = getPassphrase();
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const store = JSON.parse(await decrypt(raw, pass));
      return store[key] ?? null;
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: unknown): Promise<void> {
    const pass = getPassphrase();
    const raw = localStorage.getItem(STORAGE_KEY);
    const store = raw ? JSON.parse(await decrypt(raw, pass)) : {};
    store[key] = value;
    localStorage.setItem(STORAGE_KEY, await encrypt(JSON.stringify(store), pass));
  },

  async removeItem(key: string): Promise<void> {
    const pass = getPassphrase();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const store = JSON.parse(await decrypt(raw, pass));
    delete store[key];
    localStorage.setItem(STORAGE_KEY, await encrypt(JSON.stringify(store), pass));
  },
};
