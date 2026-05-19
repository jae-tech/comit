-- users.email → users.username 컬럼 이름 변경
-- 기존 UNIQUE 제약 제거 후 새 제약 추가
--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "email" TO "username";
--> statement-breakpoint
-- 기존 unique 제약 이름이 "users_email_unique"이므로 제거 후 재생성
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_unique";
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE ("username");
