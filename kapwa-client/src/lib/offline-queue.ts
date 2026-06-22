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
  status: 'pending' | 'synced' | 'conflict' | 'failed';
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
  const queue = loadQueue();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const change: QueuedChange = {
    id,
    tableName: table,
    recordId,
    operation,
    payload,
    clientUpdatedAt: now,
    serverVersion: 0,
    status: 'pending',
    retryCount: 0
  };

  queue.push(change);
  saveQueue(queue);
  await incrementLocalVersion(table);

  return change;
}


export async function getPendingChanges(): Promise<QueuedChange[]> {
  const queue = loadQueue();
  return queue.filter(c => c.status === 'pending');
}

export async function markSynced(id: string, serverVersion: number): Promise<void> {
  const queue = loadQueue();
  const change = queue.find(c => c.id === id);
  if (change) {
    change.status = 'synced';
    if (change.serverVersion === 0) change.serverVersion = serverVersion;
    saveQueue(queue);
    await updateServerVersion(change.tableName, serverVersion);
  }
}

export async function markConflict(id: string, error: string): Promise<void> {
  const queue = loadQueue();
  const change = queue.find(c => c.id === id);
  if (change) {
    change.status = 'conflict';
    change.lastError = error;
    change.retryCount++;
    saveQueue(queue);
  }
}

export async function markFailed(id: string, error: string): Promise<void> {
  const queue = loadQueue();
  const change = queue.find(c => c.id === id);
  if (change) {
    change.status = 'failed';
    change.lastError = error;
    saveQueue(queue);
  }
}




export async function incrementLocalVersion(table: string): Promise<void> {
  const versions = loadVersions();
  let vec = versions.find(v => v.tableName === table);
  
  if (vec) {
    vec.localVersion++;
  } else {
    vec = { tableName: table, localVersion: 1, serverVersion: 0, lastSyncedAt: null };
    versions.push(vec);
  }
  
  saveVersions(versions);
}

export async function updateServerVersion(table: string, version: number): Promise<void> {
  const versions = loadVersions();
  let vec = versions.find(v => v.tableName === table);
  
  if (vec) {
    vec.serverVersion = version;
    vec.lastSyncedAt = new Date().toISOString();
  } else {
    vec = { tableName: table, localVersion: 0, serverVersion: version, lastSyncedAt: new Date().toISOString() };
    versions.push(vec);
  }
  
  saveVersions(versions);
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
