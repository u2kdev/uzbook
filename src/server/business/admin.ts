import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  auditLogs,
  bookings,
  businesses,
  clients,
  providerApplications,
  staff,
  subscriptions,
  users,
  type AuditLog,
  type Business,
  type ProviderApplication,
  type Subscription,
  type User,
} from "@/server/db/schema";

export type AdminBusinessRow = {
  business: Business;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string | null;
  providerName: string | null;
  pending: Subscription | null;
  active: Subscription | null;
};

export async function getAdminBusinesses(): Promise<AdminBusinessRow[]> {
  const db = await getDb();
  const rows = await db
    .select({
      business: businesses,
      ownerName: users.name,
      ownerEmail: users.email,
      ownerPhone: users.phone,
    })
    .from(businesses)
    .innerJoin(users, eq(businesses.ownerId, users.id))
    .orderBy(desc(businesses.createdAt));

  const allProviders = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.role, "PROVIDER"));
  const providerMap = new Map(allProviders.map((p) => [p.id, p.name]));

  const subs = await db
    .select()
    .from(subscriptions)
    .where(inArray(subscriptions.status, ["ACTIVE", "PENDING", "PAST_DUE", "TRIAL"]))
    .orderBy(desc(subscriptions.createdAt));

  return rows.map((row) => {
    const businessSubs = subs.filter((sub) => sub.businessId === row.business.id);
    return {
      ...row,
      providerName: row.business.providerId
        ? (providerMap.get(row.business.providerId) ?? null)
        : null,
      pending: businessSubs.find((sub) => sub.status === "PENDING") ?? null,
      active: businessSubs.find((sub) => sub.status === "ACTIVE") ?? null,
    };
  });
}

export type PendingRequestRow = {
  subscription: Subscription;
  businessName: string;
  businessSlug: string;
  businessStatus: Business["status"];
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string | null;
  providerName?: string | null;
  providerPayoutCard?: string | null;
};

export async function getPendingRequests(): Promise<PendingRequestRow[]> {
  const db = await getDb();
  const rows = await db
    .select({
      subscription: subscriptions,
      businessName: businesses.name,
      businessSlug: businesses.slug,
      businessStatus: businesses.status,
      ownerName: users.name,
      ownerEmail: users.email,
      ownerPhone: users.phone,
    })
    .from(subscriptions)
    .innerJoin(businesses, eq(subscriptions.businessId, businesses.id))
    .innerJoin(users, eq(businesses.ownerId, users.id))
    .where(eq(subscriptions.status, "PENDING"))
    .orderBy(desc(subscriptions.createdAt));

  const providerUsers = await db
    .select({ id: users.id, name: users.name, payoutCard: users.payoutCard })
    .from(users)
    .where(eq(users.role, "PROVIDER"));
  const provMap = new Map(providerUsers.map((p) => [p.id, p]));

  return rows.map((r) => {
    const prov = r.subscription.providerId ? provMap.get(r.subscription.providerId) : null;
    return {
      ...r,
      providerName: prov?.name ?? null,
      providerPayoutCard: prov?.payoutCard ?? null,
    };
  });
}

export async function getAdminOverview() {
  const db = await getDb();
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    [businessCount],
    [activeBusinessCount],
    [userCount],
    [providerCount],
    [pendingProviderApps],
    [bookingCount],
    [revenue],
    activeSubs,
  ] = await Promise.all([
    db.select({ value: count() }).from(businesses),
    db.select({ value: count() }).from(businesses).where(eq(businesses.status, "ACTIVE")),
    db.select({ value: count() }).from(users),
    db.select({ value: count() }).from(users).where(eq(users.role, "PROVIDER")),
    db.select({ value: count() }).from(providerApplications).where(eq(providerApplications.status, "PENDING")),
    db.select({ value: count() }).from(bookings).where(gte(bookings.createdAt, monthAgo)),
    db
      .select({ value: sql<number>`coalesce(sum(${bookings.price}), 0)::int` })
      .from(bookings)
      .where(
        and(
          gte(bookings.createdAt, monthAgo),
          inArray(bookings.status, ["CONFIRMED", "COMPLETED"]),
        ),
      ),
    db
      .select({
        amount: subscriptions.amount,
        providerPayoutAmount: subscriptions.providerPayoutAmount,
      })
      .from(subscriptions)
      .where(eq(subscriptions.status, "ACTIVE")),
  ]);

  return {
    businesses: businessCount?.value ?? 0,
    activeBusinesses: activeBusinessCount?.value ?? 0,
    users: userCount?.value ?? 0,
    providers: providerCount?.value ?? 0,
    pendingProviderApps: pendingProviderApps?.value ?? 0,
    bookings30d: bookingCount?.value ?? 0,
    bookingValue30d: revenue?.value ?? 0,
    mrr: activeSubs.reduce((sum, row) => sum + row.amount, 0),
    providerPayoutsMrr: activeSubs.reduce((sum, row) => sum + (row.providerPayoutAmount ?? 0), 0),
    payingBusinesses: activeSubs.length,
  };
}

export type AdminUserRow = {
  user: User;
  businessesCount: number;
  businessNames: string[];
  connectedByProviderCount: number;
};

export async function getAdminUsers(): Promise<AdminUserRow[]> {
  const db = await getDb();
  const rows = await db
    .select({
      user: users,
      businessId: businesses.id,
      businessName: businesses.name,
    })
    .from(users)
    .leftJoin(businesses, eq(businesses.ownerId, users.id))
    .orderBy(desc(users.createdAt));

  const providerBiz = await db
    .select({ providerId: businesses.providerId })
    .from(businesses);

  const provCountMap = new Map<string, number>();
  for (const b of providerBiz) {
    if (b.providerId) {
      provCountMap.set(b.providerId, (provCountMap.get(b.providerId) ?? 0) + 1);
    }
  }

  const map = new Map<string, AdminUserRow>();
  for (const row of rows) {
    const existing = map.get(row.user.id) ?? {
      user: row.user,
      businessesCount: 0,
      businessNames: [],
      connectedByProviderCount: provCountMap.get(row.user.id) ?? 0,
    };
    if (row.businessId && row.businessName) {
      existing.businessesCount += 1;
      existing.businessNames.push(row.businessName);
    }
    map.set(row.user.id, existing);
  }
  return [...map.values()];
}

export type AdminSubscriptionRow = {
  subscription: Subscription;
  businessName: string;
  businessSlug: string;
  ownerEmail: string;
};

export async function getAdminSubscriptionHistory(limit = 25): Promise<AdminSubscriptionRow[]> {
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
    .orderBy(desc(subscriptions.createdAt))
    .limit(limit);
}

/* ------------------------------------------------------------------ */
/* Providers & Provider Applications                                   */
/* ------------------------------------------------------------------ */

export async function getProviderApplications(): Promise<ProviderApplication[]> {
  const db = await getDb();
  return db
    .select()
    .from(providerApplications)
    .orderBy(desc(providerApplications.createdAt));
}

export type ProviderSummaryRow = {
  provider: User;
  connectedBusinesses: {
    id: string;
    name: string;
    slug: string;
    plan: Business["plan"];
    customStaffLimit: number | null;
    customClientLimit: number | null;
    customPriceUzs: number | null;
    trialEndsAt: Date | null;
    createdAt: Date;
  }[];
  totalPlatformRevenue: number;
  totalProviderPayout: number;
  pendingPayout: number;
};

export async function getAdminProviders(): Promise<ProviderSummaryRow[]> {
  const db = await getDb();
  const providerUsers = await db
    .select()
    .from(users)
    .where(eq(users.role, "PROVIDER"))
    .orderBy(desc(users.createdAt));

  if (providerUsers.length === 0) return [];

  const providerIds = providerUsers.map((p) => p.id);
  const allBiz = await db
    .select()
    .from(businesses)
    .where(inArray(businesses.providerId, providerIds))
    .orderBy(desc(businesses.createdAt));

  const bizIds = allBiz.map((b) => b.id);
  const allSubs =
    bizIds.length > 0
      ? await db
          .select()
          .from(subscriptions)
          .where(
            sql`${subscriptions.providerId} in (${sql.join(
              providerIds.map((id) => sql`${id}`),
              sql`, `,
            )}) or ${subscriptions.businessId} in (${sql.join(
              bizIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          )
          .orderBy(desc(subscriptions.createdAt))
      : await db
          .select()
          .from(subscriptions)
          .where(inArray(subscriptions.providerId, providerIds))
          .orderBy(desc(subscriptions.createdAt));

  return providerUsers.map((prov) => {
    const connected = allBiz.filter((b) => b.providerId === prov.id);
    const connectedIds = new Set(connected.map((b) => b.id));
    const provSubs = allSubs.filter(
      (s) => s.providerId === prov.id || connectedIds.has(s.businessId),
    );

    const paidSubs = provSubs.filter(
      (s) =>
        s.amount > 0 &&
        (s.status === "ACTIVE" ||
          s.status === "PAST_DUE" ||
          (s.status === "CANCELLED" && (!s.note || !s.note.includes("Возврат")))),
    );
    const pendingSubs = provSubs.filter((s) => s.status === "PENDING" && s.amount > 0);

    const totalPlatformRevenue = paidSubs.reduce((sum, s) => sum + s.amount, 0);
    const totalProviderPayout = paidSubs.reduce(
      (sum, s) =>
        sum +
        (s.providerPayoutAmount ??
          Math.round((s.amount * (prov.commissionPercent ?? 60)) / 100)),
      0,
    );
    const pendingPayout = pendingSubs.reduce(
      (sum, s) =>
        sum +
        (s.providerPayoutAmount ??
          Math.round((s.amount * (prov.commissionPercent ?? 60)) / 100)),
      0,
    );

    return {
      provider: prov,
      connectedBusinesses: connected.map((b) => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        plan: b.plan,
        customStaffLimit: b.customStaffLimit,
        customClientLimit: b.customClientLimit,
        customPriceUzs: b.customPriceUzs,
        trialEndsAt: b.trialEndsAt,
        createdAt: b.createdAt,
      })),
      totalPlatformRevenue,
      totalProviderPayout,
      pendingPayout,
    };
  });
}

export type ProviderClientRow = {
  business: Business;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string | null;
  staffCount: number;
  clientsCount: number;
  latestSubscription: Subscription | null;
};

export async function getProviderDashboardData(providerId: string) {
  const db = await getDb();
  const [provider] = await db.select().from(users).where(eq(users.id, providerId)).limit(1);
  if (!provider) return null;

  const connectedBiz = await db
    .select({
      business: businesses,
      ownerName: users.name,
      ownerEmail: users.email,
      ownerPhone: users.phone,
    })
    .from(businesses)
    .innerJoin(users, eq(businesses.ownerId, users.id))
    .where(eq(businesses.providerId, providerId))
    .orderBy(desc(businesses.createdAt));

  const bizIds = connectedBiz.map((row) => row.business.id);
  if (bizIds.length === 0) {
    const commissionPercent = provider.commissionPercent ?? 60;
    return {
      provider,
      clients: [],
      stats: {
        connectedCount: 0,
        commissionPercent,
        totalGrossPaid: 0,
        totalEarnedCard: 0,
        expectedFromPending: 0,
      },
    };
  }

  const [staffCounts, clientCounts, allSubs] = await Promise.all([
    db
      .select({ businessId: staff.businessId, value: count() })
      .from(staff)
      .where(inArray(staff.businessId, bizIds))
      .groupBy(staff.businessId),
    db
      .select({ businessId: clients.businessId, value: count() })
      .from(clients)
      .where(inArray(clients.businessId, bizIds))
      .groupBy(clients.businessId),
    db
      .select()
      .from(subscriptions)
      .where(inArray(subscriptions.businessId, bizIds))
      .orderBy(desc(subscriptions.createdAt)),
  ]);
  const staffMap = new Map(staffCounts.map((r) => [r.businessId, Number(r.value)]));
  const clientMap = new Map(clientCounts.map((r) => [r.businessId, Number(r.value)]));

  const rows: ProviderClientRow[] = connectedBiz.map((row) => {
    const bizSubs = allSubs.filter((s) => s.businessId === row.business.id);
    const latestSubscription =
      bizSubs.find((s) => s.status === "ACTIVE") ??
      bizSubs.find((s) => s.status === "PENDING") ??
      bizSubs[0] ??
      null;

    return {
      ...row,
      staffCount: staffMap.get(row.business.id) ?? 0,
      clientsCount: clientMap.get(row.business.id) ?? 0,
      latestSubscription,
    };
  });

  const commissionPercent = provider.commissionPercent ?? 60;
  let totalGrossPaid = 0;
  let totalEarnedCard = 0;
  let expectedFromPending = 0;

  for (const sub of allSubs) {
    const isPaid =
      sub.amount > 0 &&
      (sub.status === "ACTIVE" ||
        sub.status === "PAST_DUE" ||
        (sub.status === "CANCELLED" && (!sub.note || !sub.note.includes("Возврат"))));

    if (isPaid) {
      totalGrossPaid += sub.amount;
      totalEarnedCard +=
        sub.providerPayoutAmount ?? Math.round((sub.amount * commissionPercent) / 100);
    } else if (sub.status === "PENDING" && sub.amount > 0) {
      expectedFromPending +=
        sub.providerPayoutAmount ?? Math.round((sub.amount * commissionPercent) / 100);
    }
  }

  return {
    provider,
    clients: rows,
    stats: {
      connectedCount: rows.length,
      commissionPercent,
      totalGrossPaid,
      totalEarnedCard,
      expectedFromPending,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Comprehensive Platform Audit Logs                                   */
/* ------------------------------------------------------------------ */

export type EnrichedAuditLog = {
  log: AuditLog;
  actorName: string | null;
  actorEmail: string | null;
  actorUsername: string | null;
  actorRole: User["role"] | null;
  businessName: string | null;
};

export async function getPlatformAuditLogs(limit = 300): Promise<EnrichedAuditLog[]> {
  const db = await getDb();
  const rows = await db
    .select({
      log: auditLogs,
      actorName: users.name,
      actorEmail: users.email,
      actorUsername: users.username,
      actorRole: users.role,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

  const allBiz = await db
    .select({ id: businesses.id, name: businesses.name })
    .from(businesses);
  const bizMap = new Map(allBiz.map((b) => [b.id, b.name]));

  return rows.map((r) => {
    const details = (r.log.details ?? {}) as Record<string, unknown>;
    const businessNameFromDetails =
      typeof details.businessName === "string" ? details.businessName : null;
    const businessNameFromEntity =
      r.log.entityType === "business" ? (bizMap.get(r.log.entityId) ?? null) : null;

    return {
      ...r,
      businessName: businessNameFromDetails ?? businessNameFromEntity,
    };
  });
}
