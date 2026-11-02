"use server";

import { revalidatePath } from "next/cache";
import { and, count, desc, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "@/server/db";
import { businesses, payments, subscriptions, users } from "@/server/db/schema";
import { requireAdmin } from "@/server/auth/session";
import {
  BILLING_PERIODS,
  calculatePlanPrice,
  planById,
  type BillingPeriodMonths,
  type PlanId,
} from "@/lib/plans";
import { recordAuditLog } from "@/server/payments/service";

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

export type CustomPlanOptions = {
  months?: BillingPeriodMonths;
  customPriceUzs?: number | null;
  customPlanName?: string | null;
  discountPercent?: number | null;
  customStaffLimit?: number | null;
  customClientLimit?: number | null;
};

export async function setBusinessPlanAction(
  businessId: string,
  plan: PlanId,
  options?: CustomPlanOptions,
): Promise<AdminState> {
  const session = await requireAdminRole();
  if (!["TRIAL", "START", "PRO", "BUSINESS"].includes(plan)) {
    return { error: "Неизвестный тариф" };
  }
  const db = await getDb();
  const now = new Date();
  const planObj = planById(plan);

  const rawMonths = options?.months ?? 1;
  const months = ([1, 3, 6, 12].includes(rawMonths) ? rawMonths : 1) as BillingPeriodMonths;

  const ok = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);
    if (!existing) return false;

    const [activeSub] = await tx
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.businessId, businessId),
          eq(subscriptions.status, "ACTIVE"),
        ),
      )
      .orderBy(desc(subscriptions.currentPeriodEnd))
      .limit(1);

    const baseDate =
      plan !== "TRIAL" &&
      existing.plan === plan &&
      activeSub?.currentPeriodEnd &&
      activeSub.currentPeriodEnd.getTime() > now.getTime()
        ? activeSub.currentPeriodEnd
        : now;

    const periodDurationDays = plan === "TRIAL" ? 14 : months * 30;
    const periodEnd = new Date(baseDate.getTime() + periodDurationDays * 24 * 60 * 60 * 1000);

    await tx
      .update(subscriptions)
      .set({ status: "CANCELLED" })
      .where(
        and(
          eq(subscriptions.businessId, businessId),
          inArray(subscriptions.status, ["ACTIVE", "PENDING", "TRIAL"]),
        ),
      );

    const customPlanName =
      options?.customPlanName !== undefined
        ? options.customPlanName?.trim() || null
        : existing.settings?.customPlanName ?? null;

    const discountPercent =
      options?.discountPercent !== undefined
        ? (options.discountPercent !== null && options.discountPercent > 0
            ? Math.min(90, Math.max(0, Math.round(Number(options.discountPercent))))
            : null)
        : existing.settings?.discountPercent ?? null;

    const customPriceUzs =
      options?.customPriceUzs !== undefined
        ? options.customPriceUzs
        : existing.customPriceUzs;

    const customStaffLimit =
      options?.customStaffLimit !== undefined
        ? options.customStaffLimit
        : existing.customStaffLimit;

    const customClientLimit =
      options?.customClientLimit !== undefined
        ? options.customClientLimit
        : existing.customClientLimit;

    const newSettings = {
      ...(existing.settings ?? { autoConfirm: false, showPrices: true, requireEmail: false }),
      customPlanName,
      discountPercent,
    };

    await tx
      .update(businesses)
      .set({
        plan,
        trialEndsAt: plan === "TRIAL" ? periodEnd : null,
        customPriceUzs,
        customStaffLimit,
        customClientLimit,
        settings: newSettings,
      })
      .where(eq(businesses.id, businessId));

    const baseMonthlyPrice =
      customPriceUzs !== null && customPriceUzs !== undefined && customPriceUzs > 0
        ? customPriceUzs
        : planObj.priceUzs;

    const pricing = calculatePlanPrice({
      baseMonthlyPrice,
      months,
      customDiscountPercent: discountPercent ?? 0,
    });

    const effectiveAmount = plan === "TRIAL" ? 0 : pricing.totalAmountUzs;

    let providerCommissionPercent: number | null = null;
    let providerPayoutAmount: number | null = null;

    if (existing.providerId && plan !== "TRIAL") {
      const [provUser] = await tx
        .select({ commissionPercent: users.commissionPercent })
        .from(users)
        .where(eq(users.id, existing.providerId))
        .limit(1);
      const commission = provUser?.commissionPercent ?? 60;
      providerCommissionPercent = commission;
      providerPayoutAmount = Math.round((effectiveAmount * commission) / 100);
    }

    const planTitle = customPlanName || planObj.name;
    const periodText =
      plan === "TRIAL"
        ? "14 дней"
        : months === 1
          ? "1 месяц"
          : months === 12
            ? "1 год"
            : `${months} месяца`;
    const discountNote =
      pricing.discountPercent > 0 ? ` (скидка ${pricing.discountPercent}%)` : "";
    const note = `Тариф «${planTitle}» установлен администратором на ${periodText}${discountNote}`;

    await tx.insert(subscriptions).values({
      businessId,
      providerId: existing.providerId ?? null,
      plan,
      status: plan === "TRIAL" ? "TRIAL" : "ACTIVE",
      provider: "MANUAL",
      amount: effectiveAmount,
      providerCommissionPercent,
      providerPayoutAmount,
      customStaffLimit: customStaffLimit ?? null,
      customClientLimit: customClientLimit ?? null,
      startedAt: now,
      currentPeriodEnd: periodEnd,
      note,
    });

    return true;
  });

  if (!ok) return { error: "Бизнес не найден" };

  await recordAuditLog({
    userId: session.id,
    action: "business.plan_changed",
    entityType: "business",
    entityId: businessId,
    details: { plan, options },
  });
  refresh();
  return { ok: true };
}

export async function updateBusinessCustomPlanConfigAction(
  businessId: string,
  config: {
    customPlanName?: string | null;
    customPriceUzs?: number | null;
    discountPercent?: number | null;
    customStaffLimit?: number | null;
    customClientLimit?: number | null;
  },
): Promise<AdminState> {
  const session = await requireAdminRole();
  const db = await getDb();

  const [existing] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  if (!existing) return { error: "Бизнес не найден" };

  const customPlanName =
    config.customPlanName !== undefined
      ? config.customPlanName?.trim() || null
      : existing.settings?.customPlanName ?? null;

  const discountPercent =
    config.discountPercent !== undefined
      ? (config.discountPercent !== null && config.discountPercent > 0
          ? Math.min(90, Math.max(0, Math.round(Number(config.discountPercent))))
          : null)
      : existing.settings?.discountPercent ?? null;

  const newSettings = {
    ...(existing.settings ?? { autoConfirm: false, showPrices: true, requireEmail: false }),
    customPlanName,
    discountPercent,
  };

  await db
    .update(businesses)
    .set({
      customPriceUzs:
        config.customPriceUzs !== undefined
          ? (config.customPriceUzs !== null && config.customPriceUzs > 0
              ? Math.round(config.customPriceUzs)
              : null)
          : existing.customPriceUzs,
      customStaffLimit:
        config.customStaffLimit !== undefined
          ? (config.customStaffLimit !== null && config.customStaffLimit > 0
              ? Math.round(config.customStaffLimit)
              : null)
          : existing.customStaffLimit,
      customClientLimit:
        config.customClientLimit !== undefined
          ? (config.customClientLimit !== null && config.customClientLimit > 0
              ? Math.round(config.customClientLimit)
              : null)
          : existing.customClientLimit,
      settings: newSettings,
    })
    .where(eq(businesses.id, businessId));

  await recordAuditLog({
    userId: session.id,
    action: "business.custom_plan_configured",
    entityType: "business",
    entityId: businessId,
    details: config,
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

    const requestedDurationMs = subscription.currentPeriodEnd
      ? Math.max(
          30 * 24 * 60 * 60 * 1000,
          subscription.currentPeriodEnd.getTime() - subscription.createdAt.getTime(),
        )
      : 30 * 24 * 60 * 60 * 1000;
    const monthsCount = Math.max(1, Math.round(requestedDurationMs / (30 * 24 * 60 * 60 * 1000)));
    const periodEnd = new Date(base.getTime() + monthsCount * 30 * 24 * 60 * 60 * 1000);

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

    const [business] = await tx
      .select()
      .from(businesses)
      .where(eq(businesses.id, subscription.businessId))
      .limit(1);

    const effectiveAmount =
      subscription.amount && subscription.amount > 0
        ? subscription.amount
        : business?.customPriceUzs !== null &&
            business?.customPriceUzs !== undefined &&
            business.customPriceUzs > 0
          ? business.customPriceUzs
          : plan.priceUzs;

    const assignedProviderId = subscription.providerId ?? business?.providerId ?? null;
    let providerCommissionPercent = subscription.providerCommissionPercent;
    let providerPayoutAmount = subscription.providerPayoutAmount;

    if (assignedProviderId) {
      const [provUser] = await tx
        .select({ commissionPercent: users.commissionPercent })
        .from(users)
        .where(eq(users.id, assignedProviderId))
        .limit(1);
      providerCommissionPercent =
        provUser?.commissionPercent ?? subscription.providerCommissionPercent ?? 60;
      providerPayoutAmount = Math.round((effectiveAmount * providerCommissionPercent) / 100);
    }

    await tx
      .update(subscriptions)
      .set({
        status: "ACTIVE",
        providerId: assignedProviderId,
        amount: effectiveAmount,
        customStaffLimit: subscription.customStaffLimit ?? business?.customStaffLimit ?? null,
        customClientLimit: subscription.customClientLimit ?? business?.customClientLimit ?? null,
        providerCommissionPercent,
        providerPayoutAmount,
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
  role: "OWNER" | "SUPPORT" | "ADMIN" | "PROVIDER",
): Promise<AdminState> {
  const session = await requireAdminRole();
  if (userId === session.id) return { error: "Нельзя изменить собственную роль" };
  if (!["OWNER", "SUPPORT", "ADMIN", "PROVIDER"].includes(role)) return { error: "Неизвестная роль" };

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
