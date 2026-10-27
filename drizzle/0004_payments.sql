ALTER TYPE "public"."payment_provider" ADD VALUE IF NOT EXISTS 'PAYME';--> statement-breakpoint
ALTER TYPE "public"."payment_provider" ADD VALUE IF NOT EXISTS 'CLICK';--> statement-breakpoint
ALTER TYPE "public"."payment_provider" ADD VALUE IF NOT EXISTS 'DEMO';--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('CREATED', 'PENDING', 'PAID', 'CANCELLED', 'FAILED');--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"plan" "plan" NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"status" "payment_status" DEFAULT 'CREATED' NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'UZS' NOT NULL,
	"external_id" text NOT NULL,
	"provider_txn_id" text,
	"payload" jsonb,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_external_id_uq" ON "payments" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "payments_business_idx" ON "payments" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");
