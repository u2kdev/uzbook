"use server";

import { revalidatePath } from "next/cache";
import { and, count, desc, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "@/server/db";
import { businesses, payments, subscriptions, users } from "@/server/db/schema";
import { requireAdmin } from "@/server/auth/session";
import { planById, type PlanId } from "@/lib/plans";
import { recordAuditLog } from "@/server/payments/service";
import { notifyPaymentCompleted } from "@/server/telegram/notify";

export type AdminState = { ok?: boolean; error?: string } | null;

async function requireAdminRole() {
  const session = await requireAdmin();
  if (session.role !== "ADMIN") throw new Error("Действие доступно только администратору");
  return session;
}

function refresh() {
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/requests");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/billing");
}

export async function setBusinessStatusAction(
  businessId: string,
  status: "ACTIVE" | "SUSPENDED" | "DRAFT",
): Promise<AdminState> {
  const session = await requireAdminRole();
  const db = await getDb();
  const [updated] = await db
    .update(businesses)
    .set({ status })
    .where(eq(businesses.id, businessId))
    .returning({ id: businesses.id });
  if (!updated) return { error: "Бизнес не найден" };

  await recordAuditLog({
    userId: session.id,
    action: "business.status_changed",
    entityType: "business",
    entityId: businessId,
    details: { status },
  });
  refresh();
  return { ok: true };
}

export async function setBusinessPlanAction(
  businessId: string,
  plan: PlanId,
): Promise<AdminState> {
  const session = await requireAdminRole();
  if (!["TRIAL", "START", "PRO", "BUSINESS"].includes(plan)) {
    return { error: "Неизвестный тариф" };
  }
  const db = await getDb();
  const now = new Date();
  const periodEnd = new Date(now.getTime() + (plan === "TRIAL" ? 14 : 30) * 24 * 60 * 60 * 1000);
  const planObj = planById(plan);

  const ok = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);
    if (!existing) return false;

    await tx
      .update(subscriptions)
      .set({ status: "CANCELLED" })
      .where(
        and(
          eq(subscriptions.businessId, businessId),
          inArray(subscriptions.status, ["ACTIVE", "PENDING"]),
        ),
      );

    await tx
      .update(businesses)
      .set({
        plan,
        trialEndsAt: plan === "TRIAL" ? periodEnd : null,
      })
      .where(eq(businesses.id, businessId));

    await tx.insert(subscriptions).values({
      businessId,
      plan,
      status: plan === "TRIAL" ? "TRIAL" : "ACTIVE",
      provider: "MANUAL",
      amount: planObj.priceUzs,
      startedAt: now,
      currentPeriodEnd: periodEnd,
      note: `Тариф установлен администратором (${plan})`,
    });

    return true;
  });

  if (!ok) return { error: "Бизнес не найден" };

  await recordAuditLog({
    userId: session.id,
    action: "business.plan_changed",
    entityType: "business",
    entityId: businessId,
    details: { plan },
  });
  refresh();
  return { ok: true };
}

export async function extendTrialAction(businessId: string, days = 7): Promise<AdminState> {
  const session = await requireAdminRole();
  const safeDays = Math.min(365, Math.max(1, Math.floor(Number(days) || 7)));
  const db = await getDb();
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);
  if (!business) return { error: "Бизнес не найден" };

  const base =
    business.trialEndsAt && business.trialEndsAt.getTime() > Date.now()
      ? business.trialEndsAt.getTime()
      : Date.now();
  const periodEnd = new Date(base + safeDays * 24 * 60 * 60 * 1000);

  await db.transaction(async (tx) => {
    await tx
      .update(subscriptions)
      .set({ status: "CANCELLED" })
      .where(
        and(
          eq(subscriptions.businessId, businessId),
          inArray(subscriptions.status, ["ACTIVE", "PENDING"]),
        ),
      );

    await tx
      .update(businesses)
      .set({ plan: "TRIAL", trialEndsAt: periodEnd })
      .where(eq(businesses.id, businessId));

    await tx.insert(subscriptions).values({
      businessId,
      plan: "TRIAL",
      status: "TRIAL",
      provider: "MANUAL",
      amount: 0,
      currentPeriodEnd: periodEnd,
      note: `Пробный период продлён администратором на ${safeDays} дн.`,
    });
  });

  await recordAuditLog({
    userId: session.id,
    action: "business.trial_extended",
    entityType: "business",
    entityId: businessId,
    details: { days: safeDays, periodEnd: periodEnd.toISOString() },
  });
  refresh();
  return { ok: true };
}

export async function approveSubscriptionAction(subscriptionId: string): Promise<AdminState> {
  const session = await requireAdminRole();
  const db = await getDb();
  const now = new Date();

  const txResult = await db.transaction(async (tx) => {
    const [subscription] = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, subscriptionId))
      .limit(1)
      .for("update");

    if (!subscription) return { ok: false as const, error: "Заявка не найдена" };
    if (subscription.status !== "PENDING") {
      return { ok: false as const, error: "Заявка уже обработана" };
    }

    const plan = planById(subscription.plan);

    const [active] = await tx
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.businessId, subscription.businessId),
          eq(subscriptions.status, "ACTIVE"),
        ),
      )
      .orderBy(desc(subscriptions.currentPeriodEnd))
      .limit(1);

    const base =
      active?.currentPeriodEnd && active.currentPeriodEnd.getTime() > now.getTime()
        ? active.currentPeriodEnd
        : now;
    const periodEnd = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);

    await tx
      .update(subscriptions)
      .set({
        status: "CANCELLED",
      })
      .where(
        and(
          eq(subscriptions.businessId, subscription.businessId),
          eq(subscriptions.status, "PENDING"),
          ne(subscriptions.id, subscription.id),
        ),
      );

    await tx
      .update(subscriptions)
      .set({ status: "CANCELLED" })
      .where(
        and(
          eq(subscriptions.businessId, subscription.businessId),
          eq(subscriptions.status, "ACTIVE"),
        ),
      );

    await tx
      .update(subscriptions)
      .set({
        status: "ACTIVE",
        amount: plan.priceUzs,
        startedAt: now,
        currentPeriodEnd: periodEnd,
        note: subscription.note ? `${subscription.note} (подтверждено)` : "Подтверждено администратором",
      })
      .where(eq(subscriptions.id, subscription.id));

    if (subscription.provider === "CRYPTO") {
      await tx
        .update(payments)
        .set({
          status: "PAID",
          paidAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(payments.businessId, subscription.businessId),
            eq(payments.provider, "CRYPTO"),
            inArray(payments.status, ["CREATED", "PENDING"]),
          ),
        );
    }

    await tx
      .update(businesses)
      .set({ plan: subscription.plan, trialEndsAt: null })
      .where(eq(businesses.id, subscription.businessId));

    return {
      ok: true as const,
      subscription,
      plan,
      periodEnd,
    };
  });

  if (!txResult.ok) return { error: txResult.error };

  await recordAuditLog({
    userId: session.id,
    action: "subscription.approved",
    entityType: "subscription",
    entityId: subscriptionId,
    details: {
      businessId: txResult.subscription.businessId,
      plan: txResult.subscription.plan,
      provider: txResult.subscription.provider,
    },
  });

  void notifyPaymentCompleted({
    businessId: txResult.subscription.businessId,
    plan: txResult.plan.name,
    amount: txResult.plan.priceUzs,
    currency: "UZS",
    provider: txResult.subscription.provider,
    periodEnd: txResult.periodEnd,
  });

  refresh();
  return { ok: true };
}

export async function declineSubscriptionAction(subscriptionId: string): Promise<AdminState> {
  const session = await requireAdminRole();
  const db = await getDb();
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.status, "PENDING")))
    .limit(1);

  if (!subscription) return { error: "Заявка не найдена" };

  await db.transaction(async (tx) => {
    await tx
      .update(subscriptions)
      .set({ status: "CANCELLED", note: "Отклонено администратором" })
      .where(eq(subscriptions.id, subscription.id));

    if (subscription.provider === "CRYPTO") {
      await tx
        .update(payments)
        .set({ status: "FAILED", updatedAt: new Date() })
        .where(
          and(
            eq(payments.businessId, subscription.businessId),
            eq(payments.provider, "CRYPTO"),
            inArray(payments.status, ["CREATED", "PENDING"]),
          ),
        );
    }
  });

  await recordAuditLog({
    userId: session.id,
    action: "subscription.declined",
    entityType: "subscription",
    entityId: subscriptionId,
    details: { businessId: subscription.businessId, plan: subscription.plan },
  });
  refresh();
  return { ok: true };
}

export async function setUserRoleAction(
  userId: string,
  role: "OWNER" | "SUPPORT" | "ADMIN",
): Promise<AdminState> {
  const session = await requireAdminRole();
  if (userId === session.id) return { error: "Нельзя изменить собственную роль" };
  if (!["OWNER", "SUPPORT", "ADMIN"].includes(role)) return { error: "Неизвестная роль" };

  const db = await getDb();
  const [targetUser] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!targetUser) return { error: "Пользователь не найден" };

  if (targetUser.role === "ADMIN" && role !== "ADMIN") {
    const [adminsCount] = await db
      .select({ value: count() })
      .from(users)
      .where(eq(users.role, "ADMIN"));
    if ((adminsCount?.value ?? 0) <= 1) {
      return { error: "Нельзя понизить последнего администратора платформы" };
    }
  }

  await db.update(users).set({ role }).where(eq(users.id, userId));

  await recordAuditLog({
    userId: session.id,
    action: "user.role_changed",
    entityType: "user",
    entityId: userId,
    details: { previousRole: targetUser.role, newRole: role },
  });
  refresh();
  return { ok: true };
}

/** Latest pending requests, used by the admin dashboard. */
export async function pendingSubscriptions() {
  const db = await getDb();
  return db
    .select({
      subscription: subscriptions,
      businessName: businesses.name,
      businessSlug: businesses.slug,
      ownerEmail: users.email,
    })
    .from(subscriptions)
    .innerJoin(businesses, eq(subscriptions.businessId, businesses.id))
    .innerJoin(users, eq(businesses.ownerId, users.id))
    .where(eq(subscriptions.status, "PENDING"))
    .orderBy(desc(subscriptions.createdAt))
    .limit(20);
}

export async function adminRefundPaymentAction(
  paymentId: string,
  reason = "Возврат администратором",
): Promise<AdminState> {
  const session = await requireAdminRole();
  const { refundPayment } = await import("@/server/payments/service");
  const result = await refundPayment({
    paymentId,
    reason,
    refundedByUserId: session.id,
  });

  if (!result.ok) {
    return { error: result.error ?? "Не удалось оформить возврат" };
  }

  refresh();
  return { ok: true };
}

export async function adminCancelPaymentAction(
  paymentId: string,
  reason = "Отменено администратором",
): Promise<AdminState> {
  const session = await requireAdminRole();
  const { cancelPaymentByAdmin } = await import("@/server/payments/service");
  const result = await cancelPaymentByAdmin({
    paymentId,
    reason,
    adminUserId: session.id,
  });

  if (!result.ok) {
    return { error: result.error ?? "Не удалось отменить платёж" };
  }

  refresh();
  return { ok: true };
}

export async function adminReconcileBusinessAction(businessId: string) {
  await requireAdminRole();
  const { reconcilePaymentSubscription } = await import("@/server/payments/service");
  return reconcilePaymentSubscription(businessId);
}
