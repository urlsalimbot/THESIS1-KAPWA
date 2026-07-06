import { getPendingChanges, QueuedChange, markSynced, markConflict, markFailed, getAllVersionVectors, queueChange } from './offline-queue';
import { api } from './api';

const PRIVATE_KEY_STORAGE = 'kapwa_ed25519_private';
const DEVICE_ID_STORAGE = 'kapwa_device_id';

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function ensureDeviceId(): Promise<string> {
  let deviceId = localStorage.getItem(DEVICE_ID_STORAGE);
  let jwk = localStorage.getItem(PRIVATE_KEY_STORAGE);
  if (deviceId && jwk) return deviceId;

  const keyPair = await window.crypto.subtle.generateKey(
    { name: 'Ed25519' } as any,
    true,
    ['sign', 'verify'],
  );

  const spkiDer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
  const rawKey = new Uint8Array(spkiDer).slice(12);
  deviceId = hex(rawKey.buffer);

  const jwkPrivate = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);
  localStorage.setItem(DEVICE_ID_STORAGE, deviceId);
  localStorage.setItem(PRIVATE_KEY_STORAGE, JSON.stringify(jwkPrivate));
  return deviceId;
}

async function generateSignature(deviceId: string, changes: Array<Record<string, unknown>>, isRetry = false): Promise<string> {
  try {
    const jwkRaw = localStorage.getItem(PRIVATE_KEY_STORAGE);
    if (!jwkRaw) throw new Error('No Ed25519 private key');

    const jwk = JSON.parse(jwkRaw);
    const privateKey = await window.crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'Ed25519' } as any,
      false,
      ['sign'],
    );

    const message = JSON.stringify({ deviceId, changes });
    const sig = await window.crypto.subtle.sign(
      { name: 'Ed25519' } as any,
      privateKey,
      new TextEncoder().encode(message),
    );
    return hex(sig);
  } catch (e) {
    console.error("Sync signature failed:", e);
    if (isRetry) throw new Error('Ed25519 signing unavailable');
    try {
      const freshDeviceId = await ensureDeviceId();
      return await generateSignature(freshDeviceId, changes, true);
    } catch {
      throw new Error('Ed25519 signing unavailable');
    }
  }
}

async function sendBatch(
  changes: QueuedChange[],
  idempotencyKey: string,
): Promise<{ status: string; results: any[]; serverVersionVectors: Array<Record<string, unknown>>; serverChanges: Array<Record<string, unknown>> }> {
  const deviceId = await ensureDeviceId();
  const versionVectors = await getAllVersionVectors();
  const changesPayload = changes.map(c => ({
    id: c.id,
    tableName: c.tableName,
    recordId: c.recordId,
    operation: c.operation,
    payload: c.payload,
    clientUpdatedAt: c.clientUpdatedAt,
  }));

  const signature = await generateSignature(deviceId, changesPayload);

  return api.post<{ status: string; results: any[]; serverVersionVectors: Array<Record<string, unknown>>; serverChanges: Array<Record<string, unknown>> }>('/sync/v1', {
    deviceId,
    changes: changesPayload,
    versionVectors,
    idempotencyKey,
    signature,
  });
}

/** Check whether a pending change is a queued FSM transition (offline status change). */
export function isFsmTransition(change: QueuedChange): boolean {
  return change.payload?._fsmTransition === true;
}

export async function processDeltaSync() {
  const pending = await getPendingChanges();
  if (pending.length === 0) return { status: 'no_changes', results: [] };

  const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const batchSize = 50;

  for (let i = 0; i < pending.length; i += batchSize) {
    const batch = pending.slice(i, i + batchSize);
    const batchKey = `${idempotencyKey}-${Math.floor(i / batchSize)}`;

    try {
      const result = await sendBatch(batch, batchKey);

      for (const r of result.results as any[]) {
        if (r.status === 'applied') {
          await markSynced(r.changeId, r.serverVersionVectors?.[0]?.serverVersion || 0);
        } else if (r.status === 'conflict') {
          // D-04: FSM transition conflict handling
          const change = batch.find(c => c.id === r.changeId);
          const isFsm = change ? isFsmTransition(change) : false;

          if (isFsm && r.currentState) {
            // FSM transition rejected because the case has moved past the expected state
            await markConflict(r.changeId,
              `This case is now in "${r.currentState}" state — the offline "${r.requestedState || 'status change'}" transition is no longer valid.`);
          } else if (isFsm) {
            await markConflict(r.changeId, r.reason || 'This status change could not be applied — the case state may have changed.');
          } else {
            await markConflict(r.changeId, r.reason || 'Server conflict');
          }
        } else if (r.status === 'failed') {
          await markFailed(r.changeId, r.reason || 'Unknown error');
        }
      }
    } catch (err: unknown) {
      for (const c of batch) {
        await markFailed(c.id, err instanceof Error ? err.message : String(err));
      }
    }
  }

  return await pullFromServer();
}

export async function pullFromServer() {
  const deviceId = await ensureDeviceId();
  const versionVectors = await getAllVersionVectors();

  try {
    const data = await api.post<{ serverChanges?: Array<Record<string, unknown>> }>('/sync/pull', {
      deviceId,
      versionVectors,
    });

    for (const change of data.serverChanges || []) {
      await queueChange(
        change.tableName as string || 'unknown',
        change.recordId as string || crypto.randomUUID(),
        'INSERT' as any,
        change.payload as Record<string, unknown> || {},
      );
    }
  } catch (e) { console.error("Sync:", e); }
}

export async function resolveConflictRemotely(conflictId: string, resolution: 'server' | 'client'): Promise<boolean> {
  try {
    await api.post(`/sync/conflicts/${conflictId}/resolve`, { resolution });
    return true;
  } catch (e) { console.error("Sync:", e); return false; }
}

export function isOnline(): boolean {
  return navigator.onLine;
}

export async function syncOnReconnect() {
  if (!isOnline()) return;
  await ensureDeviceId();
  await processDeltaSync();
  await pullFromServer();
}

// Register online/offline handler
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncOnReconnect();
  });
}
