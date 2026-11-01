DROP INDEX IF EXISTS "users_phone_idx";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_phone_uq" ON "users" USING btree ("phone") WHERE "phone" IS NOT NULL;
