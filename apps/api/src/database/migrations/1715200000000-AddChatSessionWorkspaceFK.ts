import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChatSessionWorkspaceFK1715200000000 implements MigrationInterface {
  name = 'AddChatSessionWorkspaceFK1715200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "chat_sessions"
        ADD CONSTRAINT "fk_chat_sessions_workspace"
        FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "chat_sessions"
        DROP CONSTRAINT "fk_chat_sessions_workspace"
    `);
  }
}
