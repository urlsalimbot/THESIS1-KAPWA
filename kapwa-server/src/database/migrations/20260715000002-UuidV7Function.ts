import { MigrationInterface, QueryRunner } from 'typeorm';

export class UuidV7Function20260715000002 implements MigrationInterface {
  name = 'UuidV7Function20260715000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION uuid_generate_v7()
      RETURNS uuid
      LANGUAGE plpgsql
      VOLATILE
      AS $$
      DECLARE
        unix_ts_ms BYTEA;
        rand BYTEA;
      BEGIN
        unix_ts_ms = substring(
          int8send((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint)
          FROM 3
        );
        rand = gen_random_bytes(10);
        RETURN encode(
          unix_ts_ms ||
          set_byte(rand, 0, (0x70 | (get_byte(rand, 0) & 0x0f)))::bytea ||
          substring(rand FROM 2 FOR 1) ||
          set_byte(rand, 2, (0x80 | (get_byte(rand, 2) & 0x3f)))::bytea ||
          substring(rand FROM 4),
          'hex'
        )::uuid;
      END;
      $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS uuid_generate_v7`);
  }
}
