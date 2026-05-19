ALTER TABLE "chat_messages" ADD COLUMN "input_tokens" integer;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "output_tokens" integer;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "embedding_tokens" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" varchar DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "personas" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "active_provider_id" uuid;