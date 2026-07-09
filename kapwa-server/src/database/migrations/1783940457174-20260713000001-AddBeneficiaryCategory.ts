import { MigrationInterface, QueryRunner } from "typeorm"

export class AddBeneficiaryCategory1783940457174 implements MigrationInterface {
    name = 'AddBeneficiaryCategory1783940457174'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS category text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE beneficiaries DROP COLUMN IF EXISTS category`);
    }
}
