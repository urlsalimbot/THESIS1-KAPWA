// Simple localStorage-based database for web build
const DB_KEY = 'kapwa_db';

export interface DbRecord {
  id: string;
  [key: string]: unknown;
}

export interface DbTable {
  [key: string]: DbRecord[];
}

export const db: DbTable = {
  beneficiaries: [],
  households: [],
  family_members: [],
  cases: [],
  interventions: [],
  sync_queue: [],
  version_vectors: []
};

function loadDb(): DbTable {
  const stored = localStorage.getItem(DB_KEY);
  if (stored) return JSON.parse(stored);
  return { ...db };
}

function saveDb(data: DbTable): void {
  localStorage.setItem(DB_KEY, JSON.stringify(data));
}

export async function initDatabase(): Promise<void> {
  loadDb();
}

export function getDatabase(): DbTable {
  return loadDb();
}

export async function execute(sql: string, params: unknown[] = []): Promise<unknown[]> {
  const data = loadDb();
  const lower = sql.trim().toLowerCase();
  if (lower.startsWith('select')) {
    const fromMatch = sql.match(/FROM\s+(\w+)/i);
    if (fromMatch) {
      const table = fromMatch[1];
      const rows = data[table] || [];
      const whereMatch = sql.match(/WHERE\s+(.+?)(?:ORDER BY|LIMIT|$)/i);
      if (whereMatch) return rows;
      return rows;
    }
  }
  return [];
}

export async function closeDatabase(): Promise<void> {
  // no-op
}

export async function getTable(tableName: string): Promise<DbRecord[]> {
  const data = loadDb();
  return data[tableName] || [];
}

export async function insertRecord(tableName: string, record: DbRecord): Promise<void> {
  const data = loadDb();
  if (!data[tableName]) data[tableName] = [];
  data[tableName].push(record);
  saveDb(data);
}

export async function updateRecord(tableName: string, id: string, updates: Partial<DbRecord>): Promise<void> {
  const data = loadDb();
  const table = data[tableName];
  if (!table) return;
  const index = table.findIndex(r => r.id === id);
  if (index >= 0) {
    table[index] = { ...table[index], ...updates };
    saveDb(data);
  }
}

export async function deleteRecord(tableName: string, id: string): Promise<void> {
  const data = loadDb();
  const table = data[tableName];
  if (!table) return;
  const index = table.findIndex(r => r.id === id);
  if (index >= 0) {
    table.splice(index, 1);
    saveDb(data);
  }
}