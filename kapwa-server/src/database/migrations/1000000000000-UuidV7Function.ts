import { MigrationInterface, QueryRunner } from 'typeorm';

export class UuidV7Function1000000000000 implements MigrationInterface {
  name = 'UuidV7Function1000000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION uuid_generate_v7()
      RETURNS uuid
      LANGUAGE plpgsql
      VOLATILE
      AS $$
      DECLARE
        unix_ts_ms bytea;
        rand bytea;
        result bytea;
      BEGIN
        unix_ts_ms = substring(
          int8send((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint)
          FROM 3
        );
        rand = gen_random_bytes(10);
        rand = set_byte(rand, 0, (0x70 | (get_byte(rand, 0) & 0x0f)));
        rand = set_byte(rand, 2, (0x80 | (get_byte(rand, 2) & 0x3f)));
        result = unix_ts_ms || substring(rand FROM 1 FOR 3) || substring(rand FROM 4 FOR 7);
        RETURN encode(result, 'hex')::uuid;
      END;
      $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS uuid_generate_v7`);
  }
}
