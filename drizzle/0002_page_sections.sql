CREATE TYPE "public"."page_section_type" AS ENUM('hero', 'staff', 'services', 'contacts', 'reviews', 'promotions', 'faq', 'gallery', 'vacancies', 'custom_html');--> statement-breakpoint
CREATE TABLE "page_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade,
	"type" "page_section_type" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "page_sections_business_idx" ON "page_sections" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "page_sections_business_sort_idx" ON "page_sections" USING btree ("business_id","sort_order");