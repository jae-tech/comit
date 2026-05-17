ALTER TABLE "chat_messages" ADD COLUMN "input_tokens" integer;
ALTER TABLE "chat_messages" ADD COLUMN "output_tokens" integer;
ALTER TABLE "documents" ADD COLUMN "embedding_tokens" integer;
CREATE INDEX IF NOT EXISTS "chat_messages_created_at_idx" ON "chat_messages" ("created_at");
