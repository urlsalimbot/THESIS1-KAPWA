import { MigrationInterface, QueryRunner } from 'typeorm';

export class MustChangePassword0000000000060 implements MigrationInterface {
  name = 'MustChangePassword0000000000060';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS must_change_password`);
  }
}
