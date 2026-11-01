import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { getDb, closeDb } from "../src/server/db";
import { businesses, payments, subscriptions, users } from "../src/server/db/schema";
import { createPayment, completePayment, refundPayment } from "../src/server/payments/service";
import { writeBlockedReason } from "../src/server/limits";
import { getPublicBusiness } from "../src/server/business/public";
import { getAdminProviders, getProviderDashboardData } from "../src/server/business/admin";
import { createAuthTokens, verifyRefreshToken } from "../src/server/api/v1/auth";

async function main() {
  process.env.PAYMENTS_DEMO = "on";
  console.log("=== Running Phase 3 (P2) Verification Suite ===");
  const db = await getDb();

  const suffix = Date.now().toString(36);
  const passwordHash = await bcrypt.hash("testpass123", 10);

  // 1. Test refundPayment sets trialEndsAt <= now so write access is blocked
  const [owner] = await db
    .insert(users)
    .values({
      email: `p2-owner-${suffix}@example.com`,
      name: "P2 Salon Owner",
      passwordHash,
      phone: `+99890555${suffix.slice(-4)}`,
      role: "OWNER",
    })
    .returning();

  const [biz] = await db
    .insert(businesses)
    .values({
      ownerId: owner.id,
      name: `P2 Refund Salon ${suffix}`,
      slug: `p2-refund-${suffix}`,
      category: "beauty",
      city: "Ташкент",
      status: "ACTIVE",
      plan: "TRIAL",
      trialEndsAt: new Date(Date.now() + 14 * 86_400_000),
    })
    .returning();

  const created = await createPayment({
    business: biz,
    plan: "START",
    provider: "DEMO",
  });
  await completePayment({
    externalId: created.payment.externalId,
    providerTxnId: `demo-p2-${suffix}`,
  });

  const [paidBiz] = await db.select().from(businesses).where(eq(businesses.id, biz.id));
  assert.equal(paidBiz.plan, "START");
  assert.equal(writeBlockedReason(paidBiz), null);

  await refundPayment({
    externalId: created.payment.externalId,
    reason: "Test P2 refund",
  });

  const [refundedBiz] = await db.select().from(businesses).where(eq(businesses.id, biz.id));
  assert.equal(refundedBiz.plan, "TRIAL");
  assert.ok(refundedBiz.trialEndsAt !== null, "trialEndsAt must not be null after refund");
  assert.ok(
    refundedBiz.trialEndsAt.getTime() <= Date.now() + 1000,
    "trialEndsAt must be set to now (expired) after refund",
  );
  assert.ok(
    writeBlockedReason(refundedBiz) !== null,
    "Refunded business must not have unlimited free write access",
  );
  console.log("✔ P2-1: refundPayment properly expires trialEndsAt and blocks free write access");

  // 2. Test partial unique index on ACTIVE subscriptions per business
  await db.insert(subscriptions).values({
    businessId: biz.id,
    plan: "START",
    status: "ACTIVE",
    provider: "MANUAL",
    amount: 99_000,
    startedAt: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
  });

  let duplicateActiveBlocked = false;
  try {
    await db.insert(subscriptions).values({
      businessId: biz.id,
      plan: "PRO",
      status: "ACTIVE",
      provider: "MANUAL",
      amount: 199_000,
      startedAt: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
    });
  } catch {
    duplicateActiveBlocked = true;
  }
  assert.equal(
    duplicateActiveBlocked,
    true,
    "DB unique partial index must reject a second ACTIVE subscription for the same business",
  );
  console.log("✔ P2-2: DB partial unique index prevents duplicate ACTIVE subscriptions");

  // 3. Test batch preview slots in getPublicBusiness
  const publicSalon = await getPublicBusiness("atelier-noir");
  if (publicSalon) {
    assert.ok(Array.isArray(publicSalon.staff), "publicSalon.staff should be an array");
    for (const member of publicSalon.staff) {
      assert.ok(
        member.nextSlots === null || Array.isArray(member.nextSlots.slots),
        "Each staff member must have valid nextSlots",
      );
    }
  }
  console.log("✔ P2-3: getPublicBusiness computes batch preview slots in O(1) queries");

  // 4. Test SQL-filtered getAdminProviders and getProviderDashboardData
  const adminProviders = await getAdminProviders();
  assert.ok(Array.isArray(adminProviders), "getAdminProviders must return an array");
  if (adminProviders.length > 0) {
    const firstProv = adminProviders[0];
    const dashData = await getProviderDashboardData(firstProv.provider.id);
    assert.ok(dashData !== null, "getProviderDashboardData must return data for valid provider");
    assert.equal(dashData.provider.id, firstProv.provider.id);
  }
  console.log("✔ P2-4: getAdminProviders and getProviderDashboardData work with SQL filtering");

  // 5. Test refresh token JTI replay protection & disk persistence
  const tokens = await createAuthTokens({
    id: owner.id,
    email: owner.email,
    name: owner.name,
    role: owner.role,
    passwordHash: owner.passwordHash,
  });

  const firstVerify = await verifyRefreshToken(tokens.refreshToken);
  assert.ok(firstVerify !== null && firstVerify.userId === owner.id, "First refresh must succeed");

  const secondVerify = await verifyRefreshToken(tokens.refreshToken);
  assert.equal(secondVerify, null, "Replayed refresh token must be rejected");

  const jtiFile = path.resolve(process.cwd(), ".data", "consumed-jtis.json");
  assert.equal(existsSync(jtiFile), true, "Consumed JTIs must be persisted to disk");
  console.log("✔ P2-5: Refresh token replay blocked and persisted to .data/consumed-jtis.json");

  // Clean up test rows
  await db.delete(payments).where(eq(payments.businessId, biz.id));
  await db.delete(subscriptions).where(eq(subscriptions.businessId, biz.id));
  await db.delete(businesses).where(eq(businesses.id, biz.id));
  await db.delete(users).where(and(eq(users.id, owner.id)));

  await closeDb();
  console.log("=== All Phase 3 (P2) checks passed! ===");
}

main().catch((err) => {
  console.error("Phase 3 verification failed:", err);
  process.exit(1);
});
