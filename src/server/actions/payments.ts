"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/server/db";
import { businesses, payments, subscriptions } from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { planById, type PlanId } from "@/lib/plans";
import {
  availableProviders,
  demoPaymentsEnabled,
  type PaymentProviderId,
} from "@/server/payments/config";
import {
  completePayment,
  createPayment,
  getPaymentByExternalId,
  markPaymentPending,
} from "@/server/payments/service";

export type PaymentActionState = {
  ok?: boolean;
  submitted?: boolean;
  error?: string;
  url?: string;
  plan?: PlanId;
} | null;

async function ownerBusiness() {
  const session = await requireUser();
  if (session.role !== "OWNER") throw new Error("Только владелец может оплачивать тариф");
  const db = await getDb();
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.ownerId, session.id))
    .limit(1);
  return { business, db };
}

function refreshBilling(slug?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/billing");
  revalidatePath("/admin");
  revalidatePath("/admin/requests");
  if (slug) revalidatePath(`/${slug}`);
}

/** Creates an online payment and returns the URL the owner should open. */
export async function startPaymentAction(
  plan: PlanId,
  provider: PaymentProviderId,
): Promise<PaymentActionState> {
  const { business } = await ownerBusiness();
  if (!business) return { error: "Сначала создайте бизнес" };

  if (!["START", "PRO", "BUSINESS"].includes(plan)) {
    return { error: "Выберите платный тариф" };
  }

  if (provider === "MANUAL") {
    return { error: "Для перевода используйте ручную заявку" };
  }

  const enabled = availableProviders().some((option) => option.id === provider);
  if (!enabled) {
    return { error: "Этот способ оплаты не настроен. Выберите другой способ." };
  }

  const current = planById(plan);
  if (current.priceUzs <= 0) return { error: "У этого тарифа нет цены" };

  try {
    const { url } = await createPayment({ business, plan, provider });
    refreshBilling(business.slug);
    return { ok: true, url };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Не удалось создать платёж",
    };
  }
}

/**
 * Test payments are confirmed by the owner on the payment page. Never enabled
 * in production unless PAYMENTS_DEMO=on is set explicitly.
 */
export async function confirmDemoPaymentAction(
  externalId: string,
): Promise<PaymentActionState> {
  const { business } = await ownerBusiness();
  if (!business) return { error: "Сначала создайте бизнес" };
  if (!demoPaymentsEnabled()) {
    return { error: "Тестовые платежи отключены. Выберите реальный способ оплаты." };
  }

  const row = await getPaymentByExternalId(externalId);
  if (!row || row.business.id !== business.id) {
    return { error: "Платёж не найден" };
  }
  if (row.payment.provider !== "DEMO") {
    return { error: "Это не тестовый платёж" };
  }
  if (row.payment.status === "PAID") {
    return { ok: true, plan: row.payment.plan };
  }
  if (row.payment.status === "CANCELLED" || row.payment.status === "FAILED") {
    return { error: "Платёж отменён. Создайте новый в разделе «Оплата»." };
  }

  const result = await completePayment({
    externalId,
    providerTxnId: `demo-${Date.now()}`,
    payload: { demo: true },
  });

  if (!result.ok) return { error: result.error };

  refreshBilling(business.slug);
  return { ok: true, plan: result.payment.plan };
}

export async function confirmCryptoPaymentAction(
  externalId: string,
  txHash: string,
): Promise<PaymentActionState> {
  const { business, db } = await ownerBusiness();
  if (!business) return { error: "Сначала создайте бизнес" };

  const cleanHash = txHash?.trim();
  if (!cleanHash || !/^(?:0x)?[a-fA-F0-9]{64}$/.test(cleanHash)) {
    return {
      error: "Укажите корректный 64-символьный hex-хеш транзакции (TXID)",
    };
  }

  const row = await getPaymentByExternalId(externalId);
  if (!row || row.business.id !== business.id) {
    return { error: "Платёж не найден" };
  }
  if (row.payment.provider !== "CRYPTO") {
    return { error: "Платёж оформлен через другой способ оплаты" };
  }
  if (row.payment.status === "PAID") {
    return { ok: true, plan: row.payment.plan };
  }
  if (row.payment.status === "CANCELLED" || row.payment.status === "FAILED" || row.payment.status === "EXPIRED") {
    return { error: "Платёж отменён или истёк. Создайте новый в разделе «Оплата»." };
  }

  // Idempotency: verify this transaction hash hasn't been used on any other payment
  const [duplicateTx] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.providerTxnId, cleanHash), ne(payments.id, row.payment.id)))
    .limit(1);

  if (duplicateTx) {
    return { error: "Этот хеш транзакции уже был использован ранее" };
  }

  // Never auto-activate subscription without on-chain verification.
  // Mark payment as PENDING and create a PENDING subscription request for admin review.
  const marked = await markPaymentPending({
    externalId,
    providerTxnId: cleanHash,
    payload: {
      ...(row.payment.payload ?? {}),
      txHash: cleanHash,
      submittedAt: new Date().toISOString(),
    },
  });

  if (!marked) {
    return { error: "Не удалось отправить транзакцию на проверку" };
  }

  const plan = planById(row.payment.plan);
  await db.transaction(async (tx) => {
    await tx
      .update(subscriptions)
      .set({ status: "CANCELLED" })
      .where(
        and(eq(subscriptions.businessId, business.id), eq(subscriptions.status, "PENDING")),
      );

    await tx.insert(subscriptions).values({
      businessId: business.id,
      plan: row.payment.plan,
      status: "PENDING",
      provider: "CRYPTO",
      amount: plan.priceUzs,
      currency: row.payment.currency,
      note: `Крипто-оплата · Заказ ${row.payment.externalId.slice(0, 8)} · TXID: ${cleanHash}`,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
  });

  refreshBilling(business.slug);
  return { ok: true, submitted: true, plan: row.payment.plan };
}
