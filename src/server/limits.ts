import { and, count, desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  businesses,
  galleryImages,
  services,
  staff,
  subscriptions,
  type Business,
} from "@/server/db/schema";
import { planById, type PlanId } from "@/lib/plans";
import { storageBytesForUrls } from "@/server/storage";

export const MB = 1024 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;

export type Usage = {
  staff: number;
  services: number;
  storageBytes: number;
};

export type SubscriptionInfo = {
  planId: PlanId;
  planName: string;
  trialDaysLeft: number | null;
  trialExpired: boolean;
  periodEnd: Date | null;
};

export async function getUsage(business: Business): Promise<Usage> {
  const db = await getDb();

  const [[staffRow], [serviceRow], gallery] = await Promise.all([
    db.select({ value: count() }).from(staff).where(eq(staff.businessId, business.id)),
    db.select({ value: count() }).from(services).where(eq(services.businessId, business.id)),
    db
      .select({ url: galleryImages.url, beforeUrl: galleryImages.beforeUrl })
      .from(galleryImages)
      .where(eq(galleryImages.businessId, business.id)),
  ]);

  const storageBytes = await storageBytesForUrls([
    business.logoUrl,
    business.coverUrl,
    ...gallery.flatMap((row) => [row.url, row.beforeUrl]),
  ]);

  return {
    staff: Number(staffRow?.value ?? 0),
    services: Number(serviceRow?.value ?? 0),
    storageBytes,
  };
}

export async function getSubscriptionInfo(business: Business): Promise<SubscriptionInfo> {
  const plan = planById(business.plan);
  const now = Date.now();
  const trialDaysLeft =
    business.plan === "TRIAL" && business.trialEndsAt
      ? Math.max(0, Math.ceil((business.trialEndsAt.getTime() - now) / DAY_MS))
      : null;
  const trialExpired =
    business.plan === "TRIAL" &&
    Boolean(business.trialEndsAt) &&
    (business.trialEndsAt as Date).getTime() < now;

  let periodEnd: Date | null = null;
  if (business.plan !== "TRIAL") {
    const db = await getDb();
    const [active] = await db
      .select({ currentPeriodEnd: subscriptions.currentPeriodEnd })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.businessId, business.id),
          eq(subscriptions.status, "ACTIVE"),
        ),
      )
      .orderBy(desc(subscriptions.currentPeriodEnd))
      .limit(1);
    periodEnd = active?.currentPeriodEnd ?? null;
  }

  return {
    planId: business.plan,
    planName: plan.name,
    trialDaysLeft,
    trialExpired,
    periodEnd,
  };
}

/** Returns an error message when the owner cannot create paid content. */
export function writeBlockedReason(business: Business): string | null {
  if (
    business.plan === "TRIAL" &&
    business.trialEndsAt &&
    business.trialEndsAt.getTime() < Date.now()
  ) {
    return "Пробный период закончился. Подключите тариф, чтобы снова менять страницу, услуги и галерею.";
  }
  return null;
}

export async function staffLimitError(business: Business): Promise<string | null> {
  const blocked = writeBlockedReason(business);
  if (blocked) return blocked;

  const plan = planById(business.plan);
  const usage = await getUsage(business);
  if (usage.staff >= plan.staffLimit) {
    return `На тарифе «${plan.name}» доступно мастеров: ${plan.staffLimit}. Лимит исчерпан — смените тариф в разделе «Оплата».`;
  }
  return null;
}

export async function serviceLimitError(business: Business): Promise<string | null> {
  const blocked = writeBlockedReason(business);
  if (blocked) return blocked;

  const plan = planById(business.plan);
  const usage = await getUsage(business);
  if (usage.services >= plan.serviceLimit) {
    return `На тарифе «${plan.name}» доступно услуг: ${plan.serviceLimit}. Лимит исчерпан — смените тариф в разделе «Оплата».`;
  }
  return null;
}

export async function storageLimitError(
  business: Business,
  extraBytes = 0,
): Promise<string | null> {
  const blocked = writeBlockedReason(business);
  if (blocked) return blocked;

  const plan = planById(business.plan);
  const usage = await getUsage(business);
  const limit = plan.storageMb * MB;
  if (usage.storageBytes + extraBytes > limit) {
    return `Хранилище тарифа «${plan.name}»: ${formatStorage(usage.storageBytes)} из ${formatStorage(limit)}. Удалите лишние фото или смените тариф.`;
  }
  return null;
}

export function formatStorage(bytes: number): string {
  if (bytes < MB) return `${Math.max(0, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / MB).toFixed(1)} МБ`;
}

export async function currentBusinessForOwner(ownerId: string) {
  const db = await getDb();
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.ownerId, ownerId))
    .limit(1);
  return business ?? null;
}

/**
 * Lazily downgrades a paid plan once its ACTIVE subscription period ends.
 * Public pages and existing bookings keep working, but paid editing becomes
 * read-only until the owner renews. Runs when the owner opens the dashboard.
 */
export async function expireBusinessIfNeeded(business: Business): Promise<Business> {
  if (business.plan === "TRIAL") return business;

  const db = await getDb();
  const [active] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.businessId, business.id),
        eq(subscriptions.status, "ACTIVE"),
      ),
    )
    .orderBy(desc(subscriptions.currentPeriodEnd))
    .limit(1);

  if (!active?.currentPeriodEnd) return business;
  if (active.currentPeriodEnd.getTime() > Date.now()) return business;
  if (active.plan !== business.plan) return business;

  await db.transaction(async (tx) => {
    await tx
      .update(subscriptions)
      .set({ status: "PAST_DUE" })
      .where(eq(subscriptions.id, active.id));
    await tx
      .update(businesses)
      .set({ plan: "TRIAL", trialEndsAt: active.currentPeriodEnd })
      .where(eq(businesses.id, business.id));
  });

  return {
    ...business,
    plan: "TRIAL",
    trialEndsAt: active.currentPeriodEnd,
  };
}
