import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Office-issued logins: `users.username`.
 *
 * Claimants who arrive at the MSWDO without an email address or a mobile number
 * had no account at all — the provisioning service flagged the intake and
 * stopped ("Claimant has no email or phone; account not created"), so the person
 * standing at the counter could never sign in to see their own case.
 *
 * The account now gets a short, printable claimant ID (`CLM-000123`) as its
 * username plus a temporary password handed over on a slip. `email` stays unique
 * and NOT NULL: an unusable synthetic address
 * (`claimant-clm-000123@claimant.kapwa.local`) keeps that constraint and every
 * existing query intact, which is the pattern the phone-only path already used.
 *
 * The unique index is partial — staff accounts and every existing row keep a
 * NULL username, and NULLs are distinct in a plain unique index only by
 * accident of Postgres' rules; being explicit is cheaper than being clever.
 */
export class ClaimantUsername0000000000101 implements MigrationInterface {
  name = 'ClaimantUsername0000000000101';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS username TEXT`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username ON users (username) WHERE username IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_users_username`);
    await queryRunner.query(`ALTER TABLE IF EXISTS users DROP COLUMN IF EXISTS username`);
  }
}
