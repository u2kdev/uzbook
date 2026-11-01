CREATE INDEX IF NOT EXISTS "users_phone_idx" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_provider_idx" ON "subscriptions" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_business_status_idx" ON "subscriptions" USING btree ("business_id", "status");--> statement-breakpoint
UPDATE "subscriptions" SET "status" = 'CANCELLED' WHERE "id" IN (
	SELECT "id" FROM (
		SELECT "id", ROW_NUMBER() OVER (PARTITION BY "business_id" ORDER BY "current_period_end" DESC NULLS LAST, "created_at" DESC) AS rn
		FROM "subscriptions"
		WHERE "status" = 'ACTIVE'
	) ranked
	WHERE ranked.rn > 1
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_one_active_per_biz_uq" ON "subscriptions" USING btree ("business_id") WHERE "status" = 'ACTIVE';
