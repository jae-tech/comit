ALTER TABLE "workspaces" ADD COLUMN "personas" jsonb DEFAULT '[]'::jsonb NOT NULL;
