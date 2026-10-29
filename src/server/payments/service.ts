import { randomUUID } from "node:crypto";
import { and, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  businesses,
  payments,
  subscriptions,
  auditLogs,
  type Business,
  type Payment,
} from "@/server/db/schema";
import { planById, type PlanId } from "@/lib/plans";
import {
  buildClickCheckoutUrl,
  buildPaymeCheckoutUrl,
  createTelegramInvoice,
  demoPaymentsEnabled,
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
  } else if (provider === "CRYPTO") {
    const { cryptoDepositConfig } = await import("./config");
    const conf = cryptoDepositConfig();
    if (!conf.address) {
      throw new Error("Криптокошелёк не настроен (укажите CRYPTO_DEPOSIT_ADDRESS)");
    }
    const cryptoAmount = Number((plan.priceUzs / conf.rateUzs).toFixed(2));
    url = `/pay/${externalId}`;
    payload = {
      asset: conf.asset,
      network: conf.network,
      depositAddress: conf.address,
      cryptoAmount,
      rateUzs: conf.rateUzs,
    };
  } else if (provider === "DEMO") {
    if (!demoPaymentsEnabled()) {
      throw new Error("Тестовые платежи отключены");
    }
  } else {
    throw new Error("Этот способ оплаты пока не поддерживается");
  }

  const [payment] = await db.transaction(async (tx) => {
    await tx
      .update(payments)
      .set({ status: "CANCELLED", updatedAt: new Date() })
      .where(
        and(
          eq(payments.businessId, business.id),
          inArray(payments.status, ["CREATED", "PENDING"]),
        ),
      );

    return tx
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
  });

  return { payment, url };
}

export async function markPaymentPending(params: {
  externalId: string;
  providerTxnId?: string;
  payload?: Record<string, unknown>;
}): Promise<boolean> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [payment] = await tx
      .select()
      .from(payments)
      .where(eq(payments.externalId, params.externalId))
      .limit(1)
      .for("update");
    if (!payment) return false;
    if (
      payment.status === "PAID" ||
      payment.status === "CANCELLED" ||
      payment.status === "EXPIRED" ||
      payment.status === "REFUNDED"
    ) {
      return false;
    }

    await tx
      .update(payments)
      .set({
        status: "PENDING",
        providerTxnId: params.providerTxnId ?? payment.providerTxnId,
        payload: { ...(payment.payload ?? {}), ...(params.payload ?? {}) },
        updatedAt: new Date(),
      })
      .where(eq(payments.id, payment.id));

    return true;
  });
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

    if (params.providerTxnId) {
      const [duplicateTx] = await tx
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.providerTxnId, params.providerTxnId),
            ne(payments.id, payment.id),
            eq(payments.status, "PAID"),
          ),
        )
        .limit(1);

      if (duplicateTx) {
        return {
          ok: false as const,
          error: "Транзакция с таким идентификатором уже была обработана",
        };
      }
    }

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

    if (
      payment.status === "CANCELLED" ||
      payment.status === "FAILED" ||
      payment.status === "REFUNDED"
    ) {
      return { ok: false as const, error: "Платёж отменён или возвращён" };
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

export async function recordAuditLog(params: {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  const db = await getDb();
  await db.insert(auditLogs).values({
    userId: params.userId ?? null,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    details: params.details ?? {},
  });
}

export async function refundPayment(params: {
  externalId?: string;
  paymentId?: string;
  reason?: string;
  refundedByUserId?: string | null;
  extraPayload?: Record<string, unknown>;
}): Promise<{ ok: boolean; error?: string }> {
  const db = await getDb();
  const conditions: SQL[] = [];
  if (params.paymentId) conditions.push(eq(payments.id, params.paymentId));
  if (params.externalId) conditions.push(eq(payments.externalId, params.externalId));
  if (conditions.length === 0) return { ok: false, error: "payment_not_specified" };

  return db.transaction(async (tx) => {
    const [payment] = await tx
      .select()
      .from(payments)
      .where(and(...conditions))
      .limit(1)
      .for("update");

    if (!payment) return { ok: false, error: "not_found" };
    if (payment.status !== "PAID") return { ok: false, error: "payment_not_paid" };

    const now = new Date();
    await tx
      .update(payments)
      .set({
        status: "REFUNDED",
        payload: {
          ...(payment.payload ?? {}),
          refund_reason: params.reason ?? "customer_refund",
          refunded_at: now.toISOString(),
          refunded_by: params.refundedByUserId ?? null,
          ...(params.extraPayload ?? {}),
        },
        updatedAt: now,
      })
      .where(eq(payments.id, payment.id));

    // Cancel current active subscription
    await tx
      .update(subscriptions)
      .set({ status: "CANCELLED", note: `Возврат средств: ${params.reason ?? "клиентский возврат"}` })
      .where(
        and(eq(subscriptions.businessId, payment.businessId), eq(subscriptions.status, "ACTIVE")),
      );

    // Rollback business plan to TRIAL
    await tx
      .update(businesses)
      .set({ plan: "TRIAL" })
      .where(eq(businesses.id, payment.businessId));

    await tx.insert(auditLogs).values({
      userId: params.refundedByUserId ?? null,
      action: "payment.refunded",
      entityType: "payment",
      entityId: payment.id,
      details: {
        externalId: payment.externalId,
        businessId: payment.businessId,
        amount: payment.amount,
        currency: payment.currency,
        reason: params.reason,
      },
    });

    return { ok: true };
  });
}

export async function cancelPaymentByAdmin(params: {
  paymentId: string;
  reason: string;
  adminUserId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const db = await getDb();
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, params.paymentId))
    .limit(1);

  if (!payment) return { ok: false, error: "not_found" };
  if (payment.status === "PAID") {
    return { ok: false, error: "cannot_cancel_paid_payment_use_refund" };
  }

  const now = new Date();
  await db
    .update(payments)
    .set({
      status: "CANCELLED",
      payload: {
        ...(payment.payload ?? {}),
        cancel_reason: params.reason,
        cancelled_by_admin: params.adminUserId,
      },
      updatedAt: now,
    })
    .where(eq(payments.id, payment.id));

  await recordAuditLog({
    userId: params.adminUserId,
    action: "payment.admin_cancelled",
    entityType: "payment",
    entityId: payment.id,
    details: { reason: params.reason, externalId: payment.externalId },
  });

  return { ok: true };
}

export async function reconcilePaymentSubscription(businessId: string): Promise<{
  businessId: string;
  hasActiveSubscription: boolean;
  activePlan: string;
  lastPayment: { id: string; status: string; plan: string; paidAt: Date | null } | null;
  synced: boolean;
  message: string;
}> {
  const db = await getDb();
  const [biz] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
  if (!biz) throw new Error("business_not_found");

  const [activeSub] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.businessId, businessId), eq(subscriptions.status, "ACTIVE")))
    .orderBy(sql`${subscriptions.currentPeriodEnd} desc nulls last`)
    .limit(1);

  const [lastPayment] = await db
    .select()
    .from(payments)
    .where(eq(payments.businessId, businessId))
    .orderBy(sql`${payments.createdAt} desc`)
    .limit(1);

  const now = new Date();
  const isSubValid = Boolean(
    activeSub?.currentPeriodEnd && activeSub.currentPeriodEnd.getTime() > now.getTime(),
  );

  let synced = true;
  let message = "OK: Состояние синхронизировано";

  if (lastPayment?.status === "PAID" && !isSubValid) {
    synced = false;
    message = "Внимание: последний платёж успешен, но активная подписка истекла или отсутствует";
  } else if (biz.plan !== "TRIAL" && !isSubValid && !biz.trialEndsAt) {
    synced = false;
    message = "Внимание: у бизнеса установлен платный тариф, но нет активной подписки";
  }

  return {
    businessId,
    hasActiveSubscription: isSubValid,
    activePlan: biz.plan,
    lastPayment: lastPayment
      ? {
          id: lastPayment.id,
          status: lastPayment.status,
          plan: lastPayment.plan,
          paidAt: lastPayment.paidAt,
        }
      : null,
    synced,
    message,
  };
}

export { PERIOD_DAYS };
