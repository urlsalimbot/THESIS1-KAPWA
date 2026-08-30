import { MigrationInterface, QueryRunner } from "typeorm"

export class ZAddChatSenderName0000000000008 implements MigrationInterface {
    name = 'ZAddChatSenderName0000000000008'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS chat_messages ADD COLUMN IF NOT EXISTS sender_name text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS chat_messages DROP COLUMN IF EXISTS sender_name`);
    }
}
