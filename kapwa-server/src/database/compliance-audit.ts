import { DataSource } from 'typeorm';
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

async function audit() {
  await dataSource.initialize();
  const q = dataSource.createQueryRunner();
  let passed = 0;
  let failed = 0;
  let warnings = 0;

  function ok(label: string, detail?: string) {
    console.log(`  ✅ ${label}${detail ? ': ' + detail : ''}`);
    passed++;
  }

  function fail(label: string, detail: string) {
    console.log(`  ❌ ${label}: ${detail}`);
    failed++;
  }

  function warn(label: string, detail: string) {
    console.log(`  ⚠️  ${label}: ${detail}`);
    warnings++;
  }

  console.log('\n🔍 KAPWA Compliance Audit\n');

  // =============================================
  // 1. RA 10173 — Consent Gating
  // =============================================
  console.log('1. RA 10173 — Data Privacy / Consent Gating');
  const [consentTable] = await q.query(
    `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'consent_ledger') AS e`
  );
  if (consentTable.e) {
    ok('consent_ledger table exists');

    const [consentStatusEnum] = await q.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'consent_ledger' AND column_name = 'status'
        AND column_default IS NOT NULL
      ) AS e`
    );
    if (consentStatusEnum.e) ok('consent_ledger.status has default');
    else warn('consent_ledger.status', 'no default value');

    const [beneficiariesConsent] = await q.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'beneficiaries' AND column_name = 'consent_status'
      ) AS e`
    );
    if (beneficiariesConsent.e) ok('beneficiaries.consent_status column exists');
    else fail('beneficiaries.consent_status', 'missing consent tracking column');

    const [consentIndex] = await q.query(
      `SELECT EXISTS (
        SELECT FROM pg_indexes WHERE indexname = 'idx_consent_beneficiary'
      ) AS e`
    );
    if (consentIndex.e) ok('consent_ledger beneficiary index exists');
    else warn('consent_ledger index', 'missing index on beneficiary_id');

    const [activeConsents] = await q.query(
      `SELECT COUNT(*)::int AS count FROM consent_ledger WHERE status = 'active'`
    );
    console.log(`     Active consent records: ${activeConsents.count}`);
  } else {
    fail('consent_ledger table', 'table not found');
  }

  // =============================================
  // 2. RLS Policy Audit
  // =============================================
  console.log('\n2. Row-Level Security (RLS)');
  const tables = ['beneficiaries', 'cases', 'interventions', 'consent_ledger', 'irf_cases'];
  for (const t of tables) {
    const [row] = await q.query(
      `SELECT relrowsecurity FROM pg_class WHERE relname = $1`, [t]
    );
    if (row && row.relrowsecurity) {
      ok(`RLS enabled on ${t}`);
    } else if (row) {
      warn(`RLS on ${t}`, 'NOT enabled');
    }
  }

  const [policies] = await q.query(
    `SELECT schemaname, tablename, policyname FROM pg_policies ORDER BY tablename`
  );
  if (policies.length > 0) {
    console.log(`     Policies found: ${policies.length}`);
    for (const p of policies) {
      console.log(`       - ${p.tablename}: ${p.policyname}`);
    }
  }

  // =============================================
  // 3. Hash-Chain Integrity (Interventions)
  // =============================================
  console.log('\n3. Hash-Chain Integrity');
  const [hashColumn] = await q.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_name = 'interventions' AND column_name = 'hash'
    ) AS e`
  );
  if (hashColumn.e) {
    ok('interventions.hash column exists');

    const [interventions] = await q.query(
      `SELECT id, amount, intervention_type, logged_at, hash,
              LAG(hash) OVER (ORDER BY logged_at) AS prev_hash
       FROM interventions ORDER BY logged_at LIMIT ${HASH_CHAIN_SAMPLE_LIMIT}`
    );
    if (interventions.length > 0) {
      let chainValid = true;
      for (const row of interventions) {
        if (row.prev_hash && row.hash) {
          const payload = `${row.id}|${row.amount}|${row.intervention_type}|${row.logged_at}`;
          const expectedHash = crypto.createHash('sha256').update(payload + row.prev_hash).digest('hex');
          if (expectedHash !== row.hash) {
            fail(`hash-chain for ${row.id}`, 'hash mismatch');
            chainValid = false;
          }
        } else if (row.hash && !row.prev_hash) {
          const payload = `${row.id}|${row.amount}|${row.intervention_type}|${row.logged_at}`;
          const expectedHash = crypto.createHash('sha256').update(payload).digest('hex');
          if (expectedHash !== row.hash) {
            warn(`genesis hash for ${row.id}`, 'does not match expected');
          }
        }
      }
      if (chainValid) ok('intervention hash chain integrity');
    } else {
      console.log('     No interventions to validate (hash chain empty)');
    }
  } else {
    warn('interventions.hash', 'column missing — add via migration');
  }

  // =============================================
  // 4. Encryption (pgcrypto)
  // =============================================
  console.log('\n4. Encryption / pgcrypto');
  const [pgcrypto] = await q.query(
    `SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') AS e`
  );
  if (pgcrypto.e) ok('pgcrypto extension installed');
  else fail('pgcrypto', 'extension not installed');

  const [uuidOssp] = await q.query(
    `SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') AS e`
  );
  if (uuidOssp.e) ok('uuid-ossp extension installed');

  // =============================================
  // 5. Required Columns
  // =============================================
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
      `SELECT COUNT(*)::int AS count FROM information_schema.columns
       WHERE table_name = $1 AND column_name = ANY($2)`,
      [table, cols]
    );
    if (count === cols.length) {
      ok(`${table}: all ${cols.length} required columns present`);
    } else {
      fail(`${table}`, `found ${count}/${cols.length} required columns`);
    }
  }

  // =============================================
  // 6. Seed Data
  // =============================================
  console.log('\n6. Seed Data');
  const counts = await Promise.all(
    ['users', 'beneficiaries', 'households', 'cases', 'interventions', 'programs', 'consent_ledger']
      .map(async (t) => {
        const [{ count }] = await q.query(`SELECT COUNT(*)::int AS count FROM ${t}`);
        return { table: t, count };
      })
  );
  for (const { table, count } of counts) {
    console.log(`     ${table}: ${count} records`);
  }

  // =============================================
  // Summary
  // =============================================
  const total = passed + failed + warnings;
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  ✅ ${passed} passed  ❌ ${failed} failed  ⚠️  ${warnings} warnings`);
  console.log(`  Score: ${Math.round((passed / total) * 100)}%`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  await q.release();
  await dataSource.destroy();
  process.exit(failed > 0 ? 1 : 0);
}

audit().catch(e => {
  console.error('Audit failed:', e.message);
  process.exit(1);
});
