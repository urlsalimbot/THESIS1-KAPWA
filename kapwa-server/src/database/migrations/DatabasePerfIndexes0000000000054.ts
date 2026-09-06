import { MigrationInterface, QueryRunner } from 'typeorm';

// Perf audit 2026-09-06: hot-path lookups had no supporting index.
// All statements are IF NOT EXISTS idempotent (safe under both boot paths).
export class DatabasePerfIndexes0000000000054 implements MigrationInterface {
  name = 'DatabasePerfIndexes0000000000054';

  private readonly statements: string[] = [
    `CREATE INDEX IF NOT EXISTS idx_inter_referral_from ON inter_agency_referrals(from_agency_id)`,
    `CREATE INDEX IF NOT EXISTS idx_inter_referral_to ON inter_agency_referrals(to_agency_id)`,
    `CREATE INDEX IF NOT EXISTS idx_inter_referral_status ON inter_agency_referrals(status)`,
    `CREATE INDEX IF NOT EXISTS idx_inter_referral_person ON inter_agency_referrals(person_id)`,
    `CREATE INDEX IF NOT EXISTS idx_inter_referral_case ON inter_agency_referrals(case_id)`,
    `CREATE INDEX IF NOT EXISTS idx_case_history_case ON case_history(case_id)`,
    `CREATE INDEX IF NOT EXISTS idx_cases_worker ON cases(assigned_worker_id)`,
    `CREATE INDEX IF NOT EXISTS idx_cases_beneficiary ON cases(beneficiary_id)`,
    `CREATE INDEX IF NOT EXISTS idx_cases_status_created ON cases(status, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_sync_device_idemp ON sync_queue(device_id, idempotency_key)`,
    `CREATE INDEX IF NOT EXISTS idx_sync_device ON sync_queue(device_id)`,
    `CREATE INDEX IF NOT EXISTS idx_irf_created ON irf_cases(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_acs_agency_date ON access_card_services(agency_id, service_date)`,
    `CREATE INDEX IF NOT EXISTS idx_acs_intervention ON access_card_services(intervention_id)`,
    `CREATE INDEX IF NOT EXISTS idx_acs_code ON access_card_services(access_card_code)`,
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of this.statements) {
      await queryRunner.query(statement);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const drops: string[] = [
      'idx_inter_referral_from', 'idx_inter_referral_to', 'idx_inter_referral_status',
      'idx_inter_referral_person', 'idx_inter_referral_case',
      'idx_case_history_case',
      'idx_cases_worker', 'idx_cases_beneficiary', 'idx_cases_status_created',
      'idx_sync_device_idemp', 'idx_sync_device',
      'idx_irf_created',
      'idx_acs_agency_date', 'idx_acs_intervention', 'idx_acs_code',
    ];
    for (const name of drops) {
      await queryRunner.query(`DROP INDEX IF EXISTS ${name}`);
    }
  }
}
