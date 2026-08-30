import { MigrationInterface, QueryRunner } from "typeorm"

export class ZAddBeneficiaryCategory0000000000007 implements MigrationInterface {
    name = 'ZAddBeneficiaryCategory0000000000007'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries ADD COLUMN IF NOT EXISTS category text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries DROP COLUMN IF EXISTS category`);
    }
}
