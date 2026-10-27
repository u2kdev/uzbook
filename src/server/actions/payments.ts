"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { businesses } from "@/server/db/schema";
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
} from "@/server/payments/service";

export type PaymentActionState = {
  ok?: boolean;
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
