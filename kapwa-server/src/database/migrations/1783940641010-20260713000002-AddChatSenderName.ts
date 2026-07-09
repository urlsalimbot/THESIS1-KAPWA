import { MigrationInterface, QueryRunner } from "typeorm"

export class AddChatSenderName1783940641010 implements MigrationInterface {
    name = 'AddChatSenderName1783940641010'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS sender_name text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE chat_messages DROP COLUMN IF EXISTS sender_name`);
    }
}
