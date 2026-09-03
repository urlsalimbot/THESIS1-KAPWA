import { MigrationInterface, QueryRunner } from 'typeorm';

// Wave 3: users.full_name was a single denormalized display string. Normalize to
// proper 3NF by storing atomic name parts (first_name / middle_name / last_name /
// name_extension), backfilling upgraded DBs by splitting full_name, then dropping
// the legacy column. The API keeps returning `fullName` via an @Expose() getter on
// the User entity, so response shape is unchanged.
export class UserNamesDecompose0000000000051 implements MigrationInterface {
  name = 'UserNamesDecompose0000000000051';

public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS middle_name TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS name_extension TEXT;

      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='full_name') THEN
          UPDATE users SET
            first_name = COALESCE(first_name, split_part(full_name, ' ', 1)),
            last_name = COALESCE(last_name,
              CASE WHEN array_length(string_to_array(full_name, ' '), 1) >= 2
                   THEN (string_to_array(full_name, ' '))[array_length(string_to_array(full_name, ' '), 1)]
                   ELSE NULL END),
            middle_name = COALESCE(middle_name,
              CASE WHEN array_length(string_to_array(full_name, ' '), 1) > 2
                   THEN array_to_string((string_to_array(full_name, ' '))[2:array_length(string_to_array(full_name, ' '), 1) - 1], ' ')
                   ELSE NULL END)
          WHERE full_name IS NOT NULL AND full_name <> '';
        END IF;
      END $$;

      ALTER TABLE users DROP COLUMN IF EXISTS full_name;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;

      UPDATE users SET
        full_name = TRIM(CONCAT_WS(' ',
          first_name, middle_name,
          CASE WHEN name_extension IS NOT NULL AND name_extension <> '' THEN CONCAT(last_name, ' ', name_extension) ELSE last_name END))
      WHERE first_name IS NOT NULL OR last_name IS NOT NULL;

      ALTER TABLE users DROP COLUMN IF EXISTS name_extension;
      ALTER TABLE users DROP COLUMN IF EXISTS last_name;
      ALTER TABLE users DROP COLUMN IF EXISTS middle_name;
      ALTER TABLE users DROP COLUMN IF EXISTS first_name;
    `);
  }
}