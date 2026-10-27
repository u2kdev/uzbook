CREATE TYPE "public"."booking_source" AS ENUM('WEB', 'TELEGRAM', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');--> statement-breakpoint
CREATE TYPE "public"."business_status" AS ENUM('DRAFT', 'ACTIVE', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('MANUAL', 'TELEGRAM_STARS', 'STRIPE', 'CRYPTO');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('TRIAL', 'START', 'PRO', 'BUSINESS');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('OWNER', 'SUPPORT', 'ADMIN');--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"client_id" uuid,
	"client_name" text NOT NULL,
	"client_phone" text NOT NULL,
	"client_email" text,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"status" "booking_status" DEFAULT 'CONFIRMED' NOT NULL,
	"source" "booking_source" DEFAULT 'WEB' NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"duration_min" integer DEFAULT 60 NOT NULL,
	"note" text,
	"manage_token" text NOT NULL,
	"cancel_reason" text,
	"cancelled_at" timestamp with time zone,
	"reminder_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'beauty' NOT NULL,
	"tagline" text,
	"description" text,
	"logo_url" text,
	"cover_url" text,
	"address" text,
	"city" text,
	"phone" text,
	"instagram" text,
	"website" text,
	"timezone" text DEFAULT 'Asia/Tashkent' NOT NULL,
	"currency" text DEFAULT 'UZS' NOT NULL,
	"status" "business_status" DEFAULT 'ACTIVE' NOT NULL,
	"plan" "plan" DEFAULT 'TRIAL' NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"settings" jsonb DEFAULT '{"slotStepMin":15,"leadTimeMin":30,"maxAdvanceDays":60,"cancellationHours":3,"autoConfirm":true,"showPrices":true,"requireEmail":false}'::jsonb NOT NULL,
	"theme" jsonb DEFAULT '{"accent":"#7c5cff","mode":"light"}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"telegram_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"date" date NOT NULL,
	"is_closed" boolean DEFAULT true NOT NULL,
	"start_minute" integer,
	"end_minute" integer
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text,
	"duration_min" integer DEFAULT 60 NOT NULL,
	"buffer_before_min" integer DEFAULT 0 NOT NULL,
	"buffer_after_min" integer DEFAULT 10 NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"title" text,
	"bio" text,
	"photo_url" text,
	"color" text DEFAULT '#7c5cff' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_services" (
	"staff_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	CONSTRAINT "staff_services_staff_id_service_id_pk" PRIMARY KEY("staff_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"plan" "plan" NOT NULL,
	"status" "subscription_status" DEFAULT 'TRIAL' NOT NULL,
	"provider" "payment_provider" DEFAULT 'MANUAL' NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'UZS' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"current_period_end" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"role" "user_role" DEFAULT 'OWNER' NOT NULL,
	"telegram_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "working_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_services" ADD CONSTRAINT "staff_services_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_services" ADD CONSTRAINT "staff_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "working_hours" ADD CONSTRAINT "working_hours_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_manage_token_uq" ON "bookings" USING btree ("manage_token");--> statement-breakpoint
CREATE INDEX "bookings_business_start_idx" ON "bookings" USING btree ("business_id","start_at");--> statement-breakpoint
CREATE INDEX "bookings_staff_start_idx" ON "bookings" USING btree ("staff_id","start_at");--> statement-breakpoint
CREATE UNIQUE INDEX "businesses_slug_uq" ON "businesses" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "businesses_owner_idx" ON "businesses" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clients_business_phone_uq" ON "clients" USING btree ("business_id","phone");--> statement-breakpoint
CREATE INDEX "clients_business_idx" ON "clients" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "schedule_exception_uq" ON "schedule_exceptions" USING btree ("staff_id","date");--> statement-breakpoint
CREATE INDEX "services_business_idx" ON "services" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "staff_business_idx" ON "staff" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "subscriptions_business_idx" ON "subscriptions" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_telegram_uq" ON "users" USING btree ("telegram_id");--> statement-breakpoint
CREATE INDEX "working_hours_staff_idx" ON "working_hours" USING btree ("staff_id","weekday");