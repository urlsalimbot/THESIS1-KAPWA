import { getPendingChanges, QueuedChange, markSynced, markConflict, markFailed, getAllVersionVectors } from './offline-queue';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const TOKEN_KEY = 'kapwa_token';

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

async function sendBatch(
  changes: QueuedChange[],
  idempotencyKey: string,
): Promise<{ status: string; results: any[]; serverVersionVectors: any[]; serverChanges: any[] }> {
  const token = getToken();
  const deviceId = localStorage.getItem('kapwa_device_id') || 'device-unknown';
  const versionVectors = await getAllVersionVectors();
  const payload = JSON.stringify(changes.map(c => ({
    id: c.id,
    tableName: c.tableName,
    recordId: c.recordId,
    operation: c.operation,
    payload: c.payload,
    clientUpdatedAt: c.clientUpdatedAt,
  })));

  const signature = await generateSignature(deviceId, payload);

  const res = await fetch(`${API_URL}/sync/v1`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      deviceId,
      changes: changes.map(c => ({
        id: c.id,
        tableName: c.tableName,
        recordId: c.recordId,
        operation: c.operation,
        payload: c.payload,
        clientUpdatedAt: c.clientUpdatedAt,
      })),
      versionVectors,
      idempotencyKey,
      signature,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Sync failed (${res.status}): ${errText}`);
  }

  return res.json();
}

export async function processDeltaSync() {
  const pending = await getPendingChanges();
  if (pending.length === 0) return { status: 'no_changes', results: [] };

  const idempotencyKey = crypto.randomUUID();
  const batchSize = 50;

  for (let i = 0; i < pending.length; i += batchSize) {
    const batch = pending.slice(i, i + batchSize);
    const batchKey = `${idempotencyKey}-${Math.floor(i / batchSize)}`;

    try {
      const result = await sendBatch(batch, batchKey);

      for (const r of result.results) {
        if (r.status === 'applied') {
          await markSynced(r.changeId, r.serverVersionVectors?.[0]?.serverVersion || 0);
        } else if (r.status === 'conflict') {
          await markConflict(r.changeId, r.reason || 'Server conflict');
        } else if (r.status === 'failed') {
          await markFailed(r.changeId, r.reason || 'Unknown error');
        }
      }
    } catch (err: any) {
      for (const c of batch) {
        await markFailed(c.id, err.message);
      }
    }
  }

  return await pullFromServer();
}

export async function pullFromServer() {
  const token = getToken();
  const deviceId = localStorage.getItem('kapwa_device_id') || 'device-unknown';
  const versionVectors = await getAllVersionVectors();

  try {
    const res = await fetch(`${API_URL}/sync/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ deviceId, versionVectors }),
    });

    if (!res.ok) return;

    const data = await res.json();
    for (const change of data.serverChanges || []) {
      const key = `kapwa_cache_${change.tableName}_${change.recordId}`;
      localStorage.setItem(key, JSON.stringify(change.payload));
    }
  } catch {
  }
}

export async function resolveConflictRemotely(conflictId: string, resolution: 'server' | 'client'): Promise<boolean> {
  const token = getToken();
  try {
    const res = await fetch(`${API_URL}/sync/conflicts/${conflictId}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ resolution }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function generateSignature(deviceId: string, payload: string): Promise<string> {
  try {
    const crypto = window.crypto.subtle;
    const key = await crypto.importKey(
      'raw',
      new TextEncoder().encode(deviceId.padEnd(32, '0').slice(0, 32)),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.sign('HMAC', key, new TextEncoder().encode(payload));
    return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return 'fallback-signature-' + Date.now();
  }
}

export function isOnline(): boolean {
  return navigator.onLine;
}

export async function syncOnReconnect() {
  if (!isOnline()) return;
  const deviceId = localStorage.getItem('kapwa_device_id');
  if (!deviceId) {
    localStorage.setItem('kapwa_device_id', crypto.randomUUID());
  }
  await processDeltaSync();
  await pullFromServer();
}

// Register online/offline handler
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncOnReconnect();
  });
}
