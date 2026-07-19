import { DataSource, QueryRunner } from 'typeorm';
import * as crypto from 'crypto';

const HASH_CHAIN_SAMPLE_LIMIT = 10;
const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'kapwa',
  password: process.env.DB_PASSWORD || 'kapwa',
  database: process.env.DB_NAME || 'kapwa',
});

class AuditLogger {
  passed = 0;
  failed = 0;
  warnings = 0;

  ok(label: string, detail?: string) {
    console.log(`  ✅ ${label}${detail ? ': ' + detail : ''}`);
    this.passed++;
  }

  fail(label: string, detail: string) {
    console.log(`  ❌ ${label}: ${detail}`);
    this.failed++;
  }

  warn(label: string, detail: string) {
    console.log(`  ⚠️  ${label}: ${detail}`);
    this.warnings++;
  }

  summary() {
    const total = this.passed + this.failed + this.warnings;
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`  ✅ ${this.passed} passed  ❌ ${this.failed} failed  ⚠️  ${this.warnings} warnings`);
    console.log(`  Score: ${Math.round((this.passed / total) * 100)}%`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  }
}

async function tableExists(q: QueryRunner, name: string): Promise<boolean> {
  const [row] = await q.query(
    `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1) AS e`, [name]
  );
  return row?.e ?? false;
}

async function columnExists(q: QueryRunner, table: string, column: string): Promise<boolean> {
  const [row] = await q.query(
    `SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = $1 AND column_name = $2) AS e`, [table, column]
  );
  return row?.e ?? false;
}

async function columnHasDefault(q: QueryRunner, table: string, column: string): Promise<boolean> {
  const [row] = await q.query(
    `SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = $1 AND column_name = $2 AND column_default IS NOT NULL) AS e`, [table, column]
  );
  return row?.e ?? false;
}

async function indexExists(q: QueryRunner, name: string): Promise<boolean> {
  const [row] = await q.query(
    `SELECT EXISTS (SELECT FROM pg_indexes WHERE indexname = $1) AS e`, [name]
  );
  return row?.e ?? false;
}

async function rlsEnabled(q: QueryRunner, table: string): Promise<boolean> {
  const [row] = await q.query(`SELECT relrowsecurity FROM pg_class WHERE relname = $1`, [table]);
  return row?.relrowsecurity ?? false;
}

async function extensionInstalled(q: QueryRunner, name: string): Promise<boolean> {
  const [row] = await q.query(`SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = $1) AS e`, [name]);
  return row?.e ?? false;
}

async function consentGatingAudit(q: QueryRunner, log: AuditLogger) {
  console.log('1. RA 10173 — Data Privacy / Consent Gating');
  const hasConsentLedger = await tableExists(q, 'consent_ledger');
  if (!hasConsentLedger) {
    log.fail('consent_ledger table', 'table not found');
    return;
  }
  log.ok('consent_ledger table exists');

  const hasDefault = await columnHasDefault(q, 'consent_ledger', 'status');
  if (hasDefault) log.ok('consent_ledger.status has default');
  else log.warn('consent_ledger.status', 'no default value');

  const hasBeneficiaryConsent = await columnExists(q, 'beneficiaries', 'consent_status');
  if (hasBeneficiaryConsent) log.ok('beneficiaries.consent_status column exists');
  else log.fail('beneficiaries.consent_status', 'missing consent tracking column');

  const hasIndex = await indexExists(q, 'idx_consent_beneficiary');
  if (hasIndex) log.ok('consent_ledger beneficiary index exists');
  else log.warn('consent_ledger index', 'missing index on beneficiary_id');

  const [activeConsents] = await q.query(`SELECT COUNT(*)::int AS count FROM consent_ledger WHERE status = 'active'`);
  console.log(`     Active consent records: ${activeConsents.count}`);
}

async function rlsAudit(q: QueryRunner, log: AuditLogger) {
  console.log('\n2. Row-Level Security (RLS)');
  const tables = ['beneficiaries', 'cases', 'interventions', 'consent_ledger', 'irf_cases'];
  for (const t of tables) {
    if (await rlsEnabled(q, t)) log.ok(`RLS enabled on ${t}`);
    else log.warn(`RLS on ${t}`, 'NOT enabled');
  }
  const policies = await q.query(`SELECT schemaname, tablename, policyname FROM pg_policies ORDER BY tablename`);
  if (policies.length > 0) {
    console.log(`     Policies found: ${policies.length}`);
    for (const p of policies) console.log(`       - ${p.tablename}: ${p.policyname}`);
  }
}

async function hashChainAudit(q: QueryRunner, log: AuditLogger) {
  console.log('\n3. Hash-Chain Integrity');
  const hasHashColumn = await columnExists(q, 'interventions', 'hash');
  if (!hasHashColumn) {
    log.warn('interventions.hash', 'column missing — add via migration');
    return;
  }
  log.ok('interventions.hash column exists');

  const interventions = await q.query(
    `SELECT id, amount, intervention_type, logged_at, hash,
            LAG(hash) OVER (ORDER BY logged_at) AS prev_hash
     FROM interventions ORDER BY logged_at LIMIT ${HASH_CHAIN_SAMPLE_LIMIT}`
  );
  if (interventions.length === 0) {
    console.log('     No interventions to validate (hash chain empty)');
    return;
  }

  let chainValid = true;
  for (const row of interventions) {
    const payload = `${row.id}|${row.amount}|${row.intervention_type}|${row.logged_at}`;
    if (row.prev_hash && row.hash) {
      const expected = crypto.createHash('sha256').update(payload + row.prev_hash).digest('hex');
      if (expected !== row.hash) { log.fail(`hash-chain for ${row.id}`, 'hash mismatch'); chainValid = false; }
    } else if (row.hash && !row.prev_hash) {
      const expected = crypto.createHash('sha256').update(payload).digest('hex');
      if (expected !== row.hash) log.warn(`genesis hash for ${row.id}`, 'does not match expected');
    }
  }
  if (chainValid) log.ok('intervention hash chain integrity');
}

async function encryptionAudit(q: QueryRunner, log: AuditLogger) {
  console.log('\n4. Encryption / pgcrypto');
  if (await extensionInstalled(q, 'pgcrypto')) log.ok('pgcrypto extension installed');
  else log.fail('pgcrypto', 'extension not installed');

  if (await extensionInstalled(q, 'uuid-ossp')) log.ok('uuid-ossp extension installed');
}

async function schemaCompletenessAudit(q: QueryRunner, log: AuditLogger) {
  console.log('\n5. Schema Completeness');
  const checks = [
    { table: 'beneficiaries', cols: ['id', 'surname', 'first_name', 'gender', 'dob', 'consent_status'] },
    { table: 'users', cols: ['id', 'email', 'password', 'role'] },
    { table: 'cases', cols: ['id', 'control_no', 'status'] },
    { table: 'interventions', cols: ['id', 'case_id', 'worker_signature_url', 'logged_by'] },
    { table: 'households', cols: ['id', 'primary_beneficiary_id'] },
    { table: 'family_members', cols: ['id', 'household_id', 'full_name', 'relationship'] },
  ];
  for (const { table, cols } of checks) {
    const [{ count }] = await q.query(
      `SELECT COUNT(*)::int AS count FROM information_schema.columns WHERE table_name = $1 AND column_name = ANY($2)`,
      [table, cols]
    );
    if (count === cols.length) log.ok(`${table}: all ${cols.length} required columns present`);
    else log.fail(`${table}`, `found ${count}/${cols.length} required columns`);
  }
}

async function seedDataAudit(q: QueryRunner) {
  console.log('\n6. Seed Data');
  const tables = ['users', 'beneficiaries', 'households', 'cases', 'interventions', 'programs', 'consent_ledger'];
  const counts = await Promise.all(
    tables.map(async (t) => {
      const [{ count }] = await q.query(`SELECT COUNT(*)::int AS count FROM ${t}`);
      return { table: t, count };
    })
  );
  for (const { table, count } of counts) console.log(`     ${table}: ${count} records`);
}

async function audit() {
  await dataSource.initialize();
  const q = dataSource.createQueryRunner();
  const log = new AuditLogger();
  console.log('\n🔍 KAPWA Compliance Audit\n');

  await consentGatingAudit(q, log);
  await rlsAudit(q, log);
  await hashChainAudit(q, log);
  await encryptionAudit(q, log);
  await schemaCompletenessAudit(q, log);
  await seedDataAudit(q);
  log.summary();

  await q.release();
  await dataSource.destroy();
  process.exit(log.failed > 0 ? 1 : 0);
}

audit().catch(e => {
  console.error('Audit failed:', e.message);
  process.exit(1);
});
