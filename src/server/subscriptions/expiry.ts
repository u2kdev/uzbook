import { and, eq, lt } from "drizzle-orm";
import { getDb } from "@/server/db";
import { businesses, subscriptions } from "@/server/db/schema";

export type ExpiryResult = {
  scanned: number;
  expired: number;
};

/**
 * Downgrades every paid plan whose ACTIVE period has ended.
 *
 * The update is conditional on the period end we read, so a concurrent
 * renewal cannot be overwritten. Public pages and existing bookings keep
 * working; only paid editing is blocked.
 */
export async function expireSubscriptions(now = new Date()): Promise<ExpiryResult> {
  const db = await getDb();
  const rows = await db
    .select({
      id: subscriptions.id,
      businessId: subscriptions.businessId,
      plan: subscriptions.plan,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
    })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, "ACTIVE"),
        lt(subscriptions.currentPeriodEnd, now),
      ),
    );

  let expired = 0;

  for (const row of rows) {
    const periodEnd = row.currentPeriodEnd;
    if (!periodEnd) continue;

    const changed = await db.transaction(async (tx) => {
      const updated = await tx
        .update(subscriptions)
        .set({ status: "PAST_DUE" })
        .where(
          and(
            eq(subscriptions.id, row.id),
            eq(subscriptions.status, "ACTIVE"),
            eq(subscriptions.currentPeriodEnd, periodEnd),
          ),
        )
        .returning({ id: subscriptions.id });

      if (updated.length === 0) return false;

      await tx
        .update(businesses)
        .set({ plan: "TRIAL", trialEndsAt: periodEnd })
        .where(
          and(
            eq(businesses.id, row.businessId),
            eq(businesses.plan, row.plan),
          ),
        );

      return true;
    });

    if (changed) expired++;
  }

  return { scanned: rows.length, expired };
}
