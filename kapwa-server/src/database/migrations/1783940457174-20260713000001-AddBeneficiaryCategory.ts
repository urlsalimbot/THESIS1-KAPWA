import { MigrationInterface, QueryRunner } from "typeorm"

export class ZAddBeneficiaryCategory1783940457174 implements MigrationInterface {
    name = 'ZAddBeneficiaryCategory1783940457174'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries ADD COLUMN IF NOT EXISTS category text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries DROP COLUMN IF EXISTS category`);
    }
}
