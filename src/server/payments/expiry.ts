import { and, eq, inArray, lt } from "drizzle-orm";
import { getDb } from "@/server/db";
import { payments, type Payment } from "@/server/db/schema";

/** How long the checkout page keeps offering an unpaid order. */
export const PAYMENT_TTL_MS = 30 * 60 * 1000;

/** Abandoned CREATED/PENDING orders are cancelled after this long. */
export const STALE_PAYMENT_MS = 24 * 60 * 60 * 1000;

export function isPaymentExpired(
  payment: Pick<Payment, "status" | "createdAt">,
  now = Date.now(),
): boolean {
  if (payment.status !== "CREATED") return false;
  return now - payment.createdAt.getTime() > PAYMENT_TTL_MS;
}

export async function expireUnpaidPayments(input?: Date | number): Promise<number> {
  const now = input instanceof Date ? input : new Date();
  const ttlMs = typeof input === "number" ? input * 60 * 1000 : PAYMENT_TTL_MS;
  const cutoff = new Date(now.getTime() - ttlMs);
  const db = await getDb();
  const rows = await db
    .update(payments)
    .set({ status: "EXPIRED", updatedAt: now })
    .where(and(eq(payments.status, "CREATED"), lt(payments.createdAt, cutoff)))
    .returning({ id: payments.id });

  return rows.length;
}

/**
 * Cancels abandoned checkout attempts. A provider callback that arrives later
 * is still handled normally by completePayment, so a late successful payment
 * is not lost.
 */
export async function cancelStalePayments(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - STALE_PAYMENT_MS);
  const db = await getDb();
  const rows = await db
    .update(payments)
    .set({ status: "CANCELLED", updatedAt: now })
    .where(
      and(
        inArray(payments.status, ["CREATED", "PENDING", "EXPIRED"]),
        lt(payments.createdAt, cutoff),
      ),
    )
    .returning({ id: payments.id });

  return rows.length;
}
