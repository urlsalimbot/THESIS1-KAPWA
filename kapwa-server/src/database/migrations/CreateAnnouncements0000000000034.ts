import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAnnouncements0000000000034 implements MigrationInterface {
  name = 'CreateAnnouncements0000000000034';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id UUID PRIMARY KEY,
        title TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        excerpt TEXT NOT NULL DEFAULT '',
        body_html TEXT NOT NULL DEFAULT '',
        body_text TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
        pinned BOOLEAN NOT NULL DEFAULT false,
        published_at TIMESTAMPTZ,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_announcements_status ON announcements(status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_announcements_slug ON announcements(slug)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_announcements_pinned_published ON announcements(pinned, published_at)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS announcements`);
  }
}
