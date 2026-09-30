import { readFileSync } from 'fs';
import { join } from 'path';
import { getMetadataArgsStorage } from 'typeorm';
import { CaseStepLock } from './case-step-lock.entity';
import { CreateCaseStepLocks0000000000074 } from '../database/migrations/CreateCaseStepLocks0000000000074';

// Records the SQL a migration emits without touching a database.
class RecordingQueryRunner {
  readonly queries: string[] = [];
  async query(sql: string): Promise<any> {
    this.queries.push(sql);
    return [];
  }
}

const MIGRATE_TS = readFileSync(join(__dirname, '..', 'database', 'migrate.ts'), 'utf8');

describe('CaseStepLock entity', () => {
  const storage = getMetadataArgsStorage();
  const table = storage.tables.find(t => t.target === CaseStepLock);

  it('maps to case_step_locks', () => {
    expect(table?.name).toBe('case_step_locks');
  });

  it('carries the columns the seal strip reads', () => {
    const cols = storage.columns.filter(c => c.target === CaseStepLock).map(c => c.propertyName);
    expect(cols).toEqual(expect.arrayContaining([
      'caseId', 'stepIndex', 'lockedBy', 'lockedByName', 'lockedAt',
    ]));
  });

  it('stores case_id as TEXT, matching the case-scoped children', () => {
    const col = storage.columns.find(c => c.target === CaseStepLock && c.propertyName === 'caseId');
    // case_interventions.case_id is TEXT in migrate.ts; a uuid column cannot
    // be written against it. No explicit type means TypeORM reflects String,
    // which it maps to TEXT.
    expect(col?.options.name).toBe('case_id');
    expect(col?.options.type).toBe(String);
    expect(col?.options.type).not.toBe('uuid');
  });

  it('constrains one seal per (case, step)', () => {
    const unique = storage.uniques.find(u => u.target === CaseStepLock);
    expect(unique?.name).toBe('uq_case_step_locks_case_step');
    expect(unique?.columns).toEqual(['caseId', 'stepIndex']);
  });

  it('indexes case_id for the strip lookup', () => {
    const idx = storage.indices.find(i => i.target === CaseStepLock);
    expect(idx?.name).toBe('idx_case_step_locks_case');
    expect(idx?.columns).toEqual(['caseId']);
  });
});

describe('CreateCaseStepLocks0000000000074 migration', () => {
  it('has the sequential key TypeORM orders by', () => {
    expect(new CreateCaseStepLocks0000000000074().name).toBe('CreateCaseStepLocks0000000000074');
    expect('CreateCaseStepLocks0000000000074'.substr(-13)).toBe('0000000000074');
  });

  it('creates the table and index idempotently', async () => {
    const q = new RecordingQueryRunner();
    await new CreateCaseStepLocks0000000000074().up(q as any);

    const sql = q.queries.join('\n');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS case_step_locks');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_case_step_locks_case');
    expect(sql).toContain('case_id TEXT NOT NULL');
    expect(sql).toContain('step_index SMALLINT NOT NULL');
    expect(sql).toContain('id UUID PRIMARY KEY DEFAULT uuid_generate_v7()');
    expect(sql).toContain('CONSTRAINT uq_case_step_locks_case_step UNIQUE (case_id, step_index)');
  });

  it('drops index before table', async () => {
    const q = new RecordingQueryRunner();
    await new CreateCaseStepLocks0000000000074().down(q as any);

    expect(q.queries.map(s => s.match(/DROP (INDEX|TABLE)/)?.[1])).toEqual(['INDEX', 'TABLE']);
  });
});

describe('migrate.ts fresh-boot parity', () => {
  // A fresh boot runs migrate.ts, not the chain, so the table must exist here
  // or it never exists in a new deployment.
  it('declares case_step_locks idempotently', () => {
    expect(MIGRATE_TS).toContain('CREATE TABLE IF NOT EXISTS case_step_locks');
    expect(MIGRATE_TS).toContain('CREATE INDEX IF NOT EXISTS idx_case_step_locks_case ON case_step_locks(case_id)');
  });

  it('uses the same column definitions as the migration', () => {
    const block = MIGRATE_TS.slice(MIGRATE_TS.indexOf('CREATE TABLE IF NOT EXISTS case_step_locks'));
    for (const fragment of [
      'id UUID PRIMARY KEY DEFAULT uuid_generate_v7()',
      'case_id TEXT NOT NULL',
      'step_index SMALLINT NOT NULL',
      'locked_by UUID',
      'locked_by_name TEXT',
      'locked_at TIMESTAMP DEFAULT NOW()',
      'CONSTRAINT uq_case_step_locks_case_step UNIQUE (case_id, step_index)',
    ]) {
      expect(block).toContain(fragment);
    }
  });
});