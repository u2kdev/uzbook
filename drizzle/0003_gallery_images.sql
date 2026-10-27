CREATE TABLE "gallery_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade,
	"url" text NOT NULL,
	"caption" text,
	"before_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "gallery_images_business_idx" ON "gallery_images" USING btree ("business_id");