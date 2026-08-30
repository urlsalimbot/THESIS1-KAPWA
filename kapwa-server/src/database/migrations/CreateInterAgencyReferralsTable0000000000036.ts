import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInterAgencyReferralsTable0000000000036 implements MigrationInterface {
  name = 'CreateInterAgencyReferralsTable0000000000036';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS inter_agency_referrals (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        case_id UUID REFERENCES cases(id),
        person_id UUID NOT NULL REFERENCES persons(id),
        from_agency_id UUID NOT NULL REFERENCES agencies(id),
        to_agency_id UUID NOT NULL REFERENCES agencies(id),
        status TEXT NOT NULL DEFAULT 'referred'
          CHECK (status IN ('referred','received','actioned','closed','declined')),
        reason TEXT NOT NULL,
        notes TEXT,
        legal_basis_code TEXT NOT NULL,
        consent_ledger_id UUID REFERENCES consent_ledger(id),
        outcome TEXT,
        received_at TIMESTAMP,
        actioned_at TIMESTAMP,
        closed_at TIMESTAMP,
        declined_reason TEXT,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_iar_person ON inter_agency_referrals(person_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_iar_from_to ON inter_agency_referrals(from_agency_id, to_agency_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_iar_status ON inter_agency_referrals(status)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_iar_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_iar_from_to`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_iar_person`);
    await queryRunner.query(`DROP TABLE IF EXISTS inter_agency_referrals`);
  }
}
