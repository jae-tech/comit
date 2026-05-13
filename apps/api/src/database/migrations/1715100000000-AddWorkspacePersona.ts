import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkspacePersona1715100000000 implements MigrationInterface {
  name = 'AddWorkspacePersona1715100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspaces"
        ADD COLUMN IF NOT EXISTS "persona_name"   VARCHAR(100),
        ADD COLUMN IF NOT EXISTS "system_prompt"  TEXT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "workspaces" DROP COLUMN IF EXISTS "system_prompt"`);
    await queryRunner.query(`ALTER TABLE "workspaces" DROP COLUMN IF EXISTS "persona_name"`);
  }
}
