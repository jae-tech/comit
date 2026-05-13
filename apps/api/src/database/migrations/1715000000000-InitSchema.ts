import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1715000000000 implements MigrationInterface {
  name = 'InitSchema1715000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // pgvector extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    // users
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "email"         VARCHAR NOT NULL UNIQUE,
        "password_hash" VARCHAR NOT NULL,
        "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // workspaces
    await queryRunner.query(`
      CREATE TABLE "workspaces" (
        "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "owner_id"   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "name"       VARCHAR NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // ai_providers
    await queryRunner.query(`
      CREATE TABLE "ai_providers" (
        "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "provider"      VARCHAR NOT NULL,
        "encrypted_key" TEXT NOT NULL,
        "iv"            TEXT NOT NULL,
        "model"         VARCHAR NOT NULL,
        "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // documents
    await queryRunner.query(`
      CREATE TABLE "documents" (
        "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspace_id" UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        "filename"     VARCHAR NOT NULL,
        "status"       VARCHAR NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','processing','ready','failed')),
        "file_size"    BIGINT NOT NULL,
        "file_path"    TEXT NOT NULL,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // document_chunks
    await queryRunner.query(`
      CREATE TABLE "document_chunks" (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "document_id" UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        "content"     TEXT NOT NULL,
        "chunk_index" INTEGER NOT NULL,
        "embedding"   vector(768),
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // HNSW 인덱스 — O(log n) cosine similarity 검색 (E3)
    await queryRunner.query(`
      CREATE INDEX ON document_chunks USING hnsw (embedding vector_cosine_ops)
    `);

    // chat_sessions
    await queryRunner.query(`
      CREATE TABLE "chat_sessions" (
        "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspace_id" UUID NOT NULL,
        "user_id"      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // chat_messages
    await queryRunner.query(`
      CREATE TABLE "chat_messages" (
        "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "session_id"     UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
        "role"           VARCHAR NOT NULL CHECK (role IN ('user','assistant')),
        "content"        TEXT NOT NULL,
        "citations_json" JSONB NOT NULL DEFAULT '[]',
        "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "document_chunks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "documents"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_providers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "workspaces"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
