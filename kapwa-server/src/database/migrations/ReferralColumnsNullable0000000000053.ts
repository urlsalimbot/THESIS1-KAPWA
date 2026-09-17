import { MigrationInterface, QueryRunner } from 'typeorm';

// Legacy-schema guard: ReferralPersonLink (0049) drops these embedded columns
// on a fresh chain replay, so each relaxation is made conditional — no-op when
// the column is already gone, still relaxing it on older DBs that carry it.
const colExists = (table: string, column: string) =>
  `EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = '${table}' AND column_name = '${column}')`;

// Wave normalization decomposed the referral's embedded name fields onto the
// linked persons row (the Referral entity now assembles them via @Expose()
// getters and never writes surname/first_name/gender/dob). The DB kept those
// columns NOT NULL, so every INSERT crashed with a null-surname violation —
// POST /referrals always returned 500. Relax the legacy columns; the flattened
// API shape is preserved through the person join.
export class ReferralColumnsNullable0000000000053 implements MigrationInterface {
  name = 'ReferralColumnsNullable0000000000053';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const column of ['surname', 'first_name', 'gender', 'dob']) {
      await queryRunner.query(
        `DO $$ BEGIN IF ${colExists('referrals', column)} THEN ALTER TABLE referrals ALTER COLUMN ${column} DROP NOT NULL; END IF; END $$;`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const column of ['surname', 'first_name', 'gender', 'dob']) {
      await queryRunner.query(
        `DO $$ BEGIN IF ${colExists('referrals', column)} THEN ALTER TABLE referrals ALTER COLUMN ${column} SET NOT NULL; END IF; END $$;`,
      );
    }
  }
}
