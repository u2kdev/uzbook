ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_telegram_uq";--> statement-breakpoint
DROP INDEX IF EXISTS "users_telegram_uq";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "telegram_id";--> statement-breakpoint
ALTER TABLE "clients" DROP COLUMN IF EXISTS "telegram_id";
