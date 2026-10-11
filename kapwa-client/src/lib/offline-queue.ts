const QUEUE_KEY = 'kapwa_sync_queue';
const VERSION_KEY = 'kapwa_version_vectors';

export type SyncOperation = 'INSERT' | 'UPDATE' | 'DELETE';

export interface QueuedChange {
  id: string;
  tableName: string;
  recordId: string;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  clientUpdatedAt: string;
  serverVersion: number;
  status: 'pending' | 'syncing' | 'synced' | 'conflict' | 'failed';
  retryCount: number;
  lastError?: string;
}

export interface VersionVector {
  tableName: string;
  localVersion: number;
  serverVersion: number;
  lastSyncedAt: string | null;
}

export function loadQueue(): QueuedChange[] {
  const stored = localStorage.getItem(QUEUE_KEY);
  return stored ? JSON.parse(stored) : [];
}

function saveQueue(queue: QueuedChange[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/** Synced entries are kept only for a week — the panel's history, not storage. */
const SYNCED_KEEP_MS = 7 * 24 * 60 * 60 * 1000;

function pruneSynced(queue: QueuedChange[]): QueuedChange[] {
  return queue.filter(
    (c) => c.status !== 'synced' || Date.now() - new Date(c.clientUpdatedAt).getTime() < SYNCED_KEEP_MS,
  );
}

/**
 * Multi-tab safety: each read-modify-write of the queue (or the version
 * vectors) runs under one lock. Without it, two tabs on the same office PC
 * overwrite each other's queued changes, because every write puts the whole
 * array back. `navigator.locks` is native (Chrome 69+, Safari 15.4+); the
 * fallback keeps jsdom/node test runs and old browsers on the previous
 * behaviour rather than erroring.
 * ceiling: a browser without `navigator.locks` still races across tabs.
 */
async function withQueueLock<T>(fn: () => T | Promise<T>): Promise<T> {
  const locks = (navigator as Navigator & {
    locks?: { request: (name: string, cb: () => T | Promise<T>) => Promise<T> };
  }).locks;
  if (!locks?.request) return fn();
  return locks.request('kapwa-sync-queue', fn);
}

/** Read-modify-write of the whole queue, locked and pruned. */
async function mutateQueue(fn: (queue: QueuedChange[]) => void): Promise<void> {
  await withQueueLock(() => {
    const queue = loadQueue();
    fn(queue);
    saveQueue(pruneSynced(queue));
  });
}

function loadVersions(): VersionVector[] {
  const stored = localStorage.getItem(VERSION_KEY);
  return stored ? JSON.parse(stored) : [];
}

function saveVersions(versions: VersionVector[]): void {
  localStorage.setItem(VERSION_KEY, JSON.stringify(versions));
}

export async function queueChange(
  table: string,
  recordId: string,
  operation: SyncOperation,
  payload: Record<string, unknown>
): Promise<QueuedChange> {
  const now = new Date().toISOString();
  const change: QueuedChange = {
    id: crypto.randomUUID(),
    tableName: table,
    recordId,
    operation,
    payload,
    clientUpdatedAt: now,
    serverVersion: 0,
    status: 'pending',
    retryCount: 0
  };

  await mutateQueue((queue) => { queue.push(change); });
  await incrementLocalVersion(table);

  return change;
}


export async function getPendingChanges(): Promise<QueuedChange[]> {
  const queue = loadQueue();
  return queue.filter(c => c.status === 'pending');
}

export async function markSynced(id: string, serverVersion: number): Promise<void> {
  let tableName: string | null = null;
  await mutateQueue((queue) => {
    const change = queue.find(c => c.id === id);
    if (!change) return;
    change.status = 'synced';
    if (change.serverVersion === 0) change.serverVersion = serverVersion;
    tableName = change.tableName;
  });
  if (tableName) await updateServerVersion(tableName, serverVersion);
}

export async function markConflict(id: string, error: string): Promise<void> {
  await mutateQueue((queue) => {
    const change = queue.find(c => c.id === id);
    if (!change) return;
    change.status = 'conflict';
    change.lastError = error;
    change.retryCount++;
  });
}

export async function markFailed(id: string, error: string): Promise<void> {
  await mutateQueue((queue) => {
    const change = queue.find(c => c.id === id);
    if (!change) return;
    change.status = 'failed';
    change.lastError = error;
  });
}




export async function incrementLocalVersion(table: string): Promise<void> {
  await withQueueLock(() => {
    const versions = loadVersions();
    const vec = versions.find(v => v.tableName === table);
    if (vec) {
      vec.localVersion++;
    } else {
      versions.push({ tableName: table, localVersion: 1, serverVersion: 0, lastSyncedAt: null });
    }
    saveVersions(versions);
  });
}

export async function updateServerVersion(table: string, version: number): Promise<void> {
  await withQueueLock(() => {
    const versions = loadVersions();
    const vec = versions.find(v => v.tableName === table);
    if (vec) {
      vec.serverVersion = version;
      vec.lastSyncedAt = new Date().toISOString();
    } else {
      versions.push({ tableName: table, localVersion: 0, serverVersion: version, lastSyncedAt: new Date().toISOString() });
    }
    saveVersions(versions);
  });
}

export async function getAllVersionVectors(): Promise<VersionVector[]> {
  return loadVersions();
}
// Per D-04: social worker can initiate pending→in_review offline
export async function queueFsmTransition(caseId: string, newStatus: string, payload: Record<string, unknown> = {}): Promise<QueuedChange> {
  return queueChange('cases', caseId, 'UPDATE', {
    ...payload,
    status: newStatus,
    _fsmTransition: true,
    _clientUpdatedAt: new Date().toISOString(),
  });
}

const FINANCIAL_FIELDS = new Set(['amount', 'status', 'fundSource', 'disbursedAmount']);

export function mergeRecords(server: Record<string, unknown>, client: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const allKeys = new Set([...Object.keys(server), ...Object.keys(client)]);
  for (const key of allKeys) {
    if (key === 'notes') {
      const s = (server[key] ?? '') as string;
      const c = (client[key] ?? '') as string;
      result[key] = s && c ? `${s}\n${c}` : (s || c);
    } else if (key === 'consentStatus' && server[key] === 'revoked') {
      result[key] = 'revoked';
    } else if (FINANCIAL_FIELDS.has(key) && key in server) {
      result[key] = server[key];
    } else if (key in client) {
      result[key] = client[key];
    } else {
      result[key] = server[key];
    }
  }
  return result;
}

export function resolveConflict(strategy: 'server-wins' | 'client-wins', server: Record<string, unknown>, client: Record<string, unknown>): Record<string, unknown> {
  if (strategy === 'server-wins') return { ...client, ...server };
  return mergeRecords(server, client);
}

export async function getVersionVector(table: string): Promise<VersionVector | undefined> {
  const versions = loadVersions();
  return versions.find(v => v.tableName === table);
}

export async function getConflictChanges(): Promise<QueuedChange[]> {
  const queue = loadQueue();
  return queue.filter(c => c.status === 'conflict');
}
