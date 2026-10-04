import { readFileSync } from 'fs';
import { join } from 'path';
import { getMetadataArgsStorage } from 'typeorm';
import { CaseStepLock } from './case-step-lock.entity';
import { CreateCaseStepLocks0000000000074 } from '../database/migrations/CreateCaseStepLocks0000000000074';
import { CaseStepLocksStepKey0000000000079 } from '../database/migrations/CaseStepLocksStepKey0000000000079';

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
      'caseId', 'stepKey', 'lockedBy', 'lockedByName', 'lockedAt',
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

  it('constrains one seal per (case, step key)', () => {
    const unique = storage.uniques.find(u => u.target === CaseStepLock);
    expect(unique?.name).toBe('uq_case_step_locks_case_step_key');
    expect(unique?.columns).toEqual(['caseId', 'stepKey']);
  });

  it('indexes case_id for the strip lookup', () => {
    const idx = storage.indices.find(i => i.target === CaseStepLock);
    expect(idx?.name).toBe('idx_case_step_locks_case');
    expect(idx?.columns).toEqual(['caseId']);
  });
});

describe('CaseStepLocksStepKey0000000000079 migration', () => {
  it('has the sequential key TypeORM orders by', () => {
    expect(new CaseStepLocksStepKey0000000000079().name).toBe('CaseStepLocksStepKey0000000000079');
    expect('CaseStepLocksStepKey0000000000079'.substr(-13)).toBe('0000000000079');
  });

  it('adds step_key, backfills from step_index, rebuilds the unique, drops step_index', async () => {
    const q = new RecordingQueryRunner();
    await new CaseStepLocksStepKey0000000000079().up(q as any);

    const sql = q.queries.join('\n');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS step_key TEXT');
    // Backfill is 1:1 — the old unique guarantees one row per index value.
    expect(sql).toContain(`WHEN 0 THEN 'assessment'`);
    expect(sql).toContain(`WHEN 4 THEN 'closure'`);
    expect(sql).toContain('ALTER COLUMN step_key SET NOT NULL');
    expect(sql).toContain('DROP CONSTRAINT IF EXISTS uq_case_step_locks_case_step');
    expect(sql).toContain('ADD CONSTRAINT uq_case_step_locks_case_step_key UNIQUE (case_id, step_key)');
    expect(sql).toContain('DROP COLUMN IF EXISTS step_index');
  });
});

describe('migrate.ts fresh-boot parity', () => {
  // A fresh boot runs migrate.ts, not the chain, so the table must exist here
  // or it never exists in a new deployment — in its final (keyed) shape.
  it('declares case_step_locks idempotently', () => {
    expect(MIGRATE_TS).toContain('CREATE TABLE IF NOT EXISTS case_step_locks');
    expect(MIGRATE_TS).toContain('CREATE INDEX IF NOT EXISTS idx_case_step_locks_case ON case_step_locks(case_id)');
  });

  it('uses the same column definitions as the migrations', () => {
    const block = MIGRATE_TS.slice(MIGRATE_TS.indexOf('CREATE TABLE IF NOT EXISTS case_step_locks'));
    for (const fragment of [
      'id UUID PRIMARY KEY DEFAULT uuid_generate_v7()',
      'case_id TEXT NOT NULL',
      'step_key TEXT NOT NULL',
      'locked_by UUID',
      'locked_by_name TEXT',
      'locked_at TIMESTAMP DEFAULT NOW()',
      'CONSTRAINT uq_case_step_locks_case_step_key UNIQUE (case_id, step_key)',
    ]) {
      expect(block).toContain(fragment);
    }
  });

  it('converts an older boot (step_index shape) to keys idempotently', () => {
    expect(MIGRATE_TS).toContain('ADD COLUMN IF NOT EXISTS step_index SMALLINT');
    expect(MIGRATE_TS).toContain('DROP COLUMN IF EXISTS step_index');
  });
});