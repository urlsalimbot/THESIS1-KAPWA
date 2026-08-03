import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAgencyIdToAccessCardServices20260803000003 implements MigrationInterface {
  name = 'AddAgencyIdToAccessCardServices20260803000003';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE access_card_services ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES agencies(id)`);
    await queryRunner.query(`
      UPDATE access_card_services s
      SET agency_id = a.id
      FROM agencies a
      WHERE s.agency_id IS NULL
        AND s.agency IS NOT NULL
        AND (UPPER(s.agency) = UPPER(a.code) OR UPPER(s.agency) = UPPER(a.name))
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_acs_agency ON access_card_services(agency_id)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_acs_agency`);
    await queryRunner.query(`ALTER TABLE access_card_services DROP COLUMN IF EXISTS agency_id`);
  }
}
