ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'PROVIDER';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "commission_percent" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "payout_card" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_uq" ON "users" USING btree ("username");--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "provider_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "custom_staff_limit" integer;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "custom_client_limit" integer;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "custom_price_uzs" integer;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "businesses_provider_idx" ON "businesses" USING btree ("provider_id");--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "provider_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "custom_staff_limit" integer;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "custom_client_limit" integer;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "provider_commission_percent" integer;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "provider_payout_amount" integer;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "provider_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"telegram" text,
	"city" text,
	"payout_card" text,
	"experience_note" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"approved_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
	"reviewed_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_applications_status_idx" ON "provider_applications" USING btree ("status");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trusted_logos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"image_url" text NOT NULL,
	"link_url" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
