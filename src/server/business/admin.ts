import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  bookings,
  businesses,
  subscriptions,
  users,
  type Business,
  type Subscription,
  type User,
} from "@/server/db/schema";

export type AdminBusinessRow = {
  business: Business;
  ownerName: string;
  ownerEmail: string;
  ownerTelegramId: string | null;
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
      ownerTelegramId: users.telegramId,
    })
    .from(businesses)
    .innerJoin(users, eq(businesses.ownerId, users.id))
    .orderBy(desc(businesses.createdAt));

  const subs = await db
    .select()
    .from(subscriptions)
    .where(inArray(subscriptions.status, ["ACTIVE", "PENDING", "PAST_DUE", "TRIAL"]))
    .orderBy(desc(subscriptions.createdAt));

  return rows.map((row) => {
    const businessSubs = subs.filter((sub) => sub.businessId === row.business.id);
    return {
      ...row,
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
};

export async function getPendingRequests(): Promise<PendingRequestRow[]> {
  const db = await getDb();
  return db
    .select({
      subscription: subscriptions,
      businessName: businesses.name,
      businessSlug: businesses.slug,
      businessStatus: businesses.status,
      ownerName: users.name,
      ownerEmail: users.email,
    })
    .from(subscriptions)
    .innerJoin(businesses, eq(subscriptions.businessId, businesses.id))
    .innerJoin(users, eq(businesses.ownerId, users.id))
    .where(eq(subscriptions.status, "PENDING"))
    .orderBy(desc(subscriptions.createdAt));
}

export async function getAdminOverview() {  const db = await getDb();
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [businessCount] = await db.select({ value: count() }).from(businesses);
  const [activeBusinessCount] = await db
    .select({ value: count() })
    .from(businesses)
    .where(eq(businesses.status, "ACTIVE"));
  const [userCount] = await db.select({ value: count() }).from(users);
  const [bookingCount] = await db
    .select({ value: count() })
    .from(bookings)
    .where(gte(bookings.createdAt, monthAgo));
  const [revenue] = await db
    .select({ value: sql<number>`coalesce(sum(${bookings.price}), 0)::int` })
    .from(bookings)
    .where(
      and(
        gte(bookings.createdAt, monthAgo),
        inArray(bookings.status, ["CONFIRMED", "COMPLETED"]),
      ),
    );

  const activeSubs = await db
    .select({ amount: subscriptions.amount })
    .from(subscriptions)
    .where(eq(subscriptions.status, "ACTIVE"));

  return {
    businesses: businessCount?.value ?? 0,
    activeBusinesses: activeBusinessCount?.value ?? 0,
    users: userCount?.value ?? 0,
    bookings30d: bookingCount?.value ?? 0,
    bookingValue30d: revenue?.value ?? 0,
    mrr: activeSubs.reduce((sum, row) => sum + row.amount, 0),
    payingBusinesses: activeSubs.length,
  };
}

export type AdminUserRow = {
  user: User;
  businessesCount: number;
  businessNames: string[];
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

  const map = new Map<string, AdminUserRow>();
  for (const row of rows) {
    const existing = map.get(row.user.id) ?? {
      user: row.user,
      businessesCount: 0,
      businessNames: [],
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
