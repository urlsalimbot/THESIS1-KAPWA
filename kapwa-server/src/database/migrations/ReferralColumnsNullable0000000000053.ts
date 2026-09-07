import { MigrationInterface, QueryRunner } from 'typeorm';

// Wave normalization decomposed the referral's embedded name fields onto the
// linked persons row (the Referral entity now assembles them via @Expose()
// getters and never writes surname/first_name/gender/dob). The DB kept those
// columns NOT NULL, so every INSERT crashed with a null-surname violation —
// POST /referrals always returned 500. Relax the legacy columns; the flattened
// API shape is preserved through the person join.
export class ReferralColumnsNullable0000000000053 implements MigrationInterface {
  name = 'ReferralColumnsNullable0000000000053';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE referrals ALTER COLUMN surname DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE referrals ALTER COLUMN first_name DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE referrals ALTER COLUMN gender DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE referrals ALTER COLUMN dob DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE referrals ALTER COLUMN surname SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE referrals ALTER COLUMN first_name SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE referrals ALTER COLUMN gender SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE referrals ALTER COLUMN dob SET NOT NULL`);
  }
}