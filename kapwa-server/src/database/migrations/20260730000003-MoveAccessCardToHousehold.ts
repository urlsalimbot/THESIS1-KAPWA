import { MigrationInterface, QueryRunner } from 'typeorm';

export class MoveAccessCardToHousehold2026073000003 implements MigrationInterface {
  name = 'MoveAccessCardToHousehold2026073000003';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE households ADD COLUMN IF NOT EXISTS access_card_code VARCHAR(20)`);
    await queryRunner.query(`
      UPDATE households h
      SET access_card_code = b.access_card_code
      FROM beneficiaries b
      WHERE b.household_id = h.id AND b.access_card_code IS NOT NULL
    `);
    await queryRunner.query(`ALTER TABLE access_card_services DROP CONSTRAINT IF EXISTS access_card_services_access_card_code_fkey`);
    await queryRunner.query(`ALTER TABLE beneficiaries DROP CONSTRAINT IF EXISTS beneficiaries_access_card_code_key`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_beneficiary_access_card`);
    await queryRunner.query(`ALTER TABLE beneficiaries DROP COLUMN IF EXISTS access_card_code`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS access_card_code VARCHAR(20)`);
    await queryRunner.query(`
      UPDATE beneficiaries b
      SET access_card_code = h.access_card_code
      FROM households h
      WHERE h.id = b.household_id AND h.access_card_code IS NOT NULL
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS beneficiaries_access_card_code_key ON beneficiaries(access_card_code)`);
    await queryRunner.query(`ALTER TABLE access_card_services ADD CONSTRAINT access_card_services_access_card_code_fkey FOREIGN KEY (access_card_code) REFERENCES beneficiaries(access_card_code)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_beneficiary_access_card ON beneficiaries(access_card_code)`);
    await queryRunner.query(`ALTER TABLE households DROP COLUMN IF EXISTS access_card_code`);
  }
}
