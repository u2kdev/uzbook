"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "@/server/db";
import { businesses, subscriptions, users } from "@/server/db/schema";
import { requireAdmin } from "@/server/auth/session";
import { planById, type PlanId } from "@/lib/plans";

export type AdminState = { ok?: boolean; error?: string } | null;

async function requireAdminRole() {
  const session = await requireAdmin();
  if (session.role !== "ADMIN") throw new Error("Действие доступно только администратору");
  return session;
}

function refresh() {
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/billing");
}

export async function setBusinessStatusAction(
  businessId: string,
  status: "ACTIVE" | "SUSPENDED" | "DRAFT",
): Promise<AdminState> {
  await requireAdminRole();
  const db = await getDb();
  await db.update(businesses).set({ status }).where(eq(businesses.id, businessId));
  refresh();
  return { ok: true };
}

export async function setBusinessPlanAction(
  businessId: string,
  plan: PlanId,
): Promise<AdminState> {
  await requireAdminRole();
  if (!["TRIAL", "START", "PRO", "BUSINESS"].includes(plan)) {
    return { error: "Неизвестный тариф" };
  }
  const db = await getDb();
  await db
    .update(businesses)
    .set({
      plan,
      trialEndsAt: plan === "TRIAL" ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null,
    })
    .where(eq(businesses.id, businessId));
  refresh();
  return { ok: true };
}

export async function extendTrialAction(businessId: string, days = 7): Promise<AdminState> {
  await requireAdminRole();
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
  const periodEnd = new Date(base + Math.max(1, days) * 24 * 60 * 60 * 1000);

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
      note: `Пробный период продлён администратором на ${days} дн.`,
    });
  });

  refresh();
  return { ok: true };
}

export async function approveSubscriptionAction(subscriptionId: string): Promise<AdminState> {
  await requireAdminRole();
  const db = await getDb();
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId))
    .limit(1);
  if (!subscription) return { error: "Заявка не найдена" };
  if (subscription.status !== "PENDING") return { error: "Заявка уже обработана" };

  const plan = planById(subscription.plan);
  const now = new Date();

  await db.transaction(async (tx) => {
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
        note: "Подтверждено администратором",
      })
      .where(eq(subscriptions.id, subscription.id));

    await tx
      .update(businesses)
      .set({ plan: subscription.plan, trialEndsAt: null })
      .where(eq(businesses.id, subscription.businessId));
  });

  refresh();
  return { ok: true };
}

export async function declineSubscriptionAction(subscriptionId: string): Promise<AdminState> {
  await requireAdminRole();
  const db = await getDb();
  await db
    .update(subscriptions)
    .set({ status: "CANCELLED", note: "Отклонено администратором" })
    .where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.status, "PENDING")));
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
  await db.update(users).set({ role }).where(eq(users.id, userId));
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
