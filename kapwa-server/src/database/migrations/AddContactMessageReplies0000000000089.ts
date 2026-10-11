import { MigrationInterface, QueryRunner } from 'typeorm';

/** In-app replies to contact-message inquiries, shown in the staff inbox. */
export class AddContactMessageReplies0000000000089 implements MigrationInterface {
  name = 'AddContactMessageReplies0000000000089';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS contact_message_replies (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        message_id UUID NOT NULL REFERENCES contact_messages(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        replied_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_contact_message_replies_message
        ON contact_message_replies (message_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE contact_message_replies`);
  }
}