import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  businesses,
  payments,
  subscriptions,
  type Business,
  type Payment,
} from "@/server/db/schema";
import { planById, type PlanId } from "@/lib/plans";
import {
  buildClickCheckoutUrl,
  buildPaymeCheckoutUrl,
  createTelegramInvoice,
  type PaymentProviderId,
} from "./config";
import { logger } from "@/server/logger";
import { notifyPaymentCompleted } from "@/server/telegram/notify";

const PERIOD_DAYS = 30;
const PERIOD_MS = PERIOD_DAYS * 24 * 60 * 60 * 1000;

export type PaymentWithBusiness = { payment: Payment; business: Business };

export async function getPaymentByExternalId(
  externalId: string,
): Promise<PaymentWithBusiness | null> {
  if (!externalId || externalId.length > 100) return null;
  const db = await getDb();
  const [row] = await db
    .select({ payment: payments, business: businesses })
    .from(payments)
    .innerJoin(businesses, eq(payments.businessId, businesses.id))
    .where(eq(payments.externalId, externalId))
    .limit(1);
  return row ?? null;
}

export async function createPayment(params: {
  business: Business;
  plan: PlanId;
  provider: PaymentProviderId;
}): Promise<{ payment: Payment; url: string }> {
  const { business, provider } = params;
  if (!["START", "PRO", "BUSINESS"].includes(params.plan)) {
    throw new Error("Этот тариф нельзя оплатить");
  }

  const plan = planById(params.plan);
  const externalId = randomUUID();
  const db = await getDb();

  let url = `/pay/${externalId}`;
  let payload: Record<string, unknown> = {};

  if (provider === "PAYME") {
    const checkoutUrl = buildPaymeCheckoutUrl(plan, externalId);
    if (!checkoutUrl) throw new Error("Payme не настроен");
    url = checkoutUrl;
    payload = { checkoutUrl };
  } else if (provider === "CLICK") {
    const checkoutUrl = buildClickCheckoutUrl(plan, externalId);
    if (!checkoutUrl) throw new Error("Click не настроен");
    url = checkoutUrl;
    payload = { checkoutUrl };
  } else if (provider === "TELEGRAM_STARS") {
    const invoiceUrl = await createTelegramInvoice({
      plan,
      externalId,
      businessName: business.name,
    });
    if (!invoiceUrl) throw new Error("Не удалось создать счёт в Telegram");
    url = invoiceUrl;
    payload = { invoiceUrl };
  } else if (provider !== "DEMO") {
    throw new Error("Этот способ оплаты пока не поддерживается");
  }

  await db
    .update(payments)
    .set({ status: "CANCELLED", updatedAt: new Date() })
    .where(
      and(
        eq(payments.businessId, business.id),
        inArray(payments.status, ["CREATED", "PENDING"]),
      ),
    );

  const [payment] = await db
    .insert(payments)
    .values({
      businessId: business.id,
      plan: params.plan,
      provider,
      status: "CREATED",
      amount: plan.priceUzs,
      currency: "UZS",
      externalId,
      payload,
    })
    .returning();

  return { payment, url };
}

export async function markPaymentPending(params: {
  externalId: string;
  providerTxnId?: string;
  payload?: Record<string, unknown>;
}): Promise<boolean> {
  const db = await getDb();
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.externalId, params.externalId))
    .limit(1);
  if (!payment) return false;
  if (payment.status === "PAID" || payment.status === "CANCELLED") return false;

  await db
    .update(payments)
    .set({
      status: "PENDING",
      providerTxnId: params.providerTxnId ?? payment.providerTxnId,
      payload: { ...(payment.payload ?? {}), ...(params.payload ?? {}) },
      updatedAt: new Date(),
    })
    .where(eq(payments.id, payment.id));

  return true;
}

/**
 * Idempotently marks a payment as paid and activates a 30-day subscription.
 * The current subscription period is extended when it has not expired yet.
 */
export async function completePayment(params: {
  externalId: string;
  providerTxnId?: string;
  payload?: Record<string, unknown>;
}): Promise<
  | { ok: true; alreadyPaid: boolean; payment: Payment; business: Business; periodEnd: Date }
  | { ok: false; error: string }
> {
  const db = await getDb();

  const res = await db.transaction(async (tx) => {
    const [payment] = await tx
      .select()
      .from(payments)
      .where(eq(payments.externalId, params.externalId))
      .limit(1)
      .for("update");

    if (!payment) return { ok: false as const, error: "Платёж не найден" };

    const [business] = await tx
      .select()
      .from(businesses)
      .where(eq(businesses.id, payment.businessId))
      .limit(1);
    if (!business) return { ok: false as const, error: "Бизнес не найден" };

    const [active] = await tx
      .select()
      .from(subscriptions)
      .where(
        and(eq(subscriptions.businessId, business.id), eq(subscriptions.status, "ACTIVE")),
      )
      .orderBy(sql`${subscriptions.currentPeriodEnd} desc nulls last`)
      .limit(1);

    const plan = planById(payment.plan);
    const now = new Date();
    const base =
      active?.currentPeriodEnd && active.currentPeriodEnd.getTime() > now.getTime()
        ? active.currentPeriodEnd
        : now;
    const periodEnd = new Date(base.getTime() + PERIOD_MS);

    if (payment.status === "PAID") {
      return {
        ok: true as const,
        alreadyPaid: true,
        payment,
        business,
        periodEnd: active?.currentPeriodEnd ?? periodEnd,
      };
    }

    if (payment.status === "CANCELLED" || payment.status === "FAILED") {
      return { ok: false as const, error: "Платёж отменён" };
    }

    await tx
      .update(payments)
      .set({
        status: "PAID",
        providerTxnId: params.providerTxnId ?? payment.providerTxnId,
        payload: { ...(payment.payload ?? {}), ...(params.payload ?? {}) },
        paidAt: now,
        updatedAt: now,
      })
      .where(eq(payments.id, payment.id));

    // A manual request is no longer relevant once an online payment succeeded.
    await tx
      .update(subscriptions)
      .set({ status: "CANCELLED" })
      .where(
        and(eq(subscriptions.businessId, business.id), eq(subscriptions.status, "PENDING")),
      );

    // Keep one ACTIVE subscription per business; the new period already
    // includes the remaining days of the previous one.
    await tx
      .update(subscriptions)
      .set({ status: "CANCELLED" })
      .where(
        and(eq(subscriptions.businessId, business.id), eq(subscriptions.status, "ACTIVE")),
      );

    await tx.insert(subscriptions).values({
      businessId: business.id,
      plan: payment.plan,
      status: "ACTIVE",
      provider: payment.provider,
      amount: plan.priceUzs,
      currency: payment.currency,
      startedAt: now,
      currentPeriodEnd: periodEnd,
      note: `Онлайн-оплата · ${payment.provider}`,
    });

    await tx
      .update(businesses)
      .set({ plan: payment.plan, trialEndsAt: null })
      .where(eq(businesses.id, business.id));

    logger.info("payment.completed", {
      paymentId: payment.id,
      externalId: params.externalId,
      businessId: business.id,
      plan: payment.plan,
      provider: payment.provider,
      amount: plan.priceUzs,
      periodEnd: periodEnd.toISOString(),
    });

    return {
      ok: true as const,
      alreadyPaid: false,
      payment: { ...payment, status: "PAID" as const, paidAt: now, updatedAt: now },
      business: { ...business, plan: payment.plan },
      periodEnd,
    };
  });

  if (res.ok && !res.alreadyPaid) {
    void notifyPaymentCompleted({
      businessId: res.business.id,
      plan: res.payment.plan,
      amount: res.payment.amount,
      currency: res.payment.currency,
      provider: res.payment.provider,
      periodEnd: res.periodEnd,
    });
  }

  return res;
}

export async function cancelPayment(params: {
  externalId?: string;
  providerTxnId?: string;
  reason?: string;
  payload?: Record<string, unknown>;
}): Promise<boolean> {
  const db = await getDb();
  const conditions = [];
  if (params.externalId) conditions.push(eq(payments.externalId, params.externalId));
  if (params.providerTxnId) conditions.push(eq(payments.providerTxnId, params.providerTxnId));
  if (conditions.length === 0) return false;

  const [existing] = await db
    .select({ payload: payments.payload })
    .from(payments)
    .where(and(...conditions))
    .limit(1);

  await db
    .update(payments)
    .set({
      status: "CANCELLED",
      payload: {
        ...(existing?.payload ?? {}),
        reason: params.reason ?? "cancelled",
        ...(params.payload ?? {}),
      },
      updatedAt: new Date(),
    })
    .where(and(...conditions));
  return true;
}

export async function failPayment(externalId: string): Promise<void> {
  const db = await getDb();
  await db
    .update(payments)
    .set({ status: "FAILED", updatedAt: new Date() })
    .where(and(eq(payments.externalId, externalId), inArray(payments.status, ["CREATED", "PENDING"])));
}

export async function getActiveSubscription(businessId: string) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.businessId, businessId), eq(subscriptions.status, "ACTIVE")))
    .orderBy(sql`${subscriptions.currentPeriodEnd} desc nulls last`)
    .limit(1);
  return row ?? null;
}

export { PERIOD_DAYS };
