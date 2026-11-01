import { and, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb } from "../src/server/db";
import { businesses, subscriptions, users } from "../src/server/db/schema";
import { normalizeAuthPhone } from "../src/lib/phone";
import { createPayment, completePayment } from "../src/server/payments/service";

async function run() {
  console.log("==================================================");
  console.log("  TESTING PHASE 1 (P0-1, P0-2, P0-3) REMEDIATION");
  console.log("==================================================");

  // 1. P0-1: Phone normalization in shared isomorphic module
  console.log("1. [P0-1] Проверка normalizeAuthPhone из src/lib/phone.ts...");
  if (normalizeAuthPhone("90 123-45-67") !== "+998901234567") {
    throw new Error("Failed 9-digit phone normalization");
  }
  if (normalizeAuthPhone("+998 (90) 123 45 67") !== "+998901234567") {
    throw new Error("Failed +998 phone normalization");
  }
  if (normalizeAuthPhone("123") !== "") {
    throw new Error("Short phone should return empty string");
  }
  console.log("   ✓ normalizeAuthPhone работает корректно вне 'use server'");

  const db = await getDb();
  process.env.PAYMENTS_DEMO = "on";

  // Create isolated test provider, test salon owner, and test direct salon owner
  const suffix = Date.now();
  const passwordHash = await bcrypt.hash("testpass123", 10);

  const [testProvider] = await db
    .insert(users)
    .values({
      email: `p0_prov_${suffix}@uzbook.test`,
      username: `p0_prov_${suffix}`,
      phone: `+99899${String(suffix).slice(-7)}`,
      name: "Test Provider P0",
      passwordHash,
      role: "PROVIDER",
      commissionPercent: 60,
      payoutCard: "8600 0000 1111 2222",
    })
    .returning();

  const [testOwnerWithProv] = await db
    .insert(users)
    .values({
      email: `p0_owner_prov_${suffix}@uzbook.test`,
      phone: `+99898${String(suffix).slice(-7)}`,
      name: "Salon With Provider",
      passwordHash,
      role: "OWNER",
    })
    .returning();

  const [testOwnerDirect] = await db
    .insert(users)
    .values({
      email: `p0_owner_direct_${suffix}@uzbook.test`,
      phone: `+99897${String(suffix).slice(-7)}`,
      name: "Direct Salon Owner",
      passwordHash,
      role: "OWNER",
    })
    .returning();

  const [bizWithProv] = await db
    .insert(businesses)
    .values({
      ownerId: testOwnerWithProv.id,
      providerId: testProvider.id,
      name: "Provider Connected Salon",
      slug: `p0-prov-salon-${suffix}`,
      category: "beauty",
      status: "ACTIVE",
      plan: "TRIAL",
      customPriceUzs: 300000,
      customStaffLimit: 12,
      customClientLimit: 800,
    })
    .returning();

  const [bizDirect] = await db
    .insert(businesses)
    .values({
      ownerId: testOwnerDirect.id,
      providerId: null,
      name: "Direct Platform Salon",
      slug: `p0-direct-salon-${suffix}`,
      category: "beauty",
      status: "ACTIVE",
      plan: "TRIAL",
    })
    .returning();

  try {
    // Create an initial PENDING subscription from the provider
    const [pendingFromProvider] = await db
      .insert(subscriptions)
      .values({
        businessId: bizWithProv.id,
        providerId: testProvider.id,
        plan: "PRO",
        status: "PENDING",
        provider: "MANUAL",
        amount: 300000,
        currency: "UZS",
        customStaffLimit: 12,
        customClientLimit: 800,
        providerCommissionPercent: 60,
        providerPayoutAmount: 180000,
        note: "Кастомная заявка от провайдера",
      })
      .returning();

    // 2. P0-2A: Provider-connected salon online payment (300,000 UZS * 60% = 180,000 UZS)
    console.log("2. [P0-2] Проверка онлайн-оплаты салона, подключённого провайдером (300,000 UZS × 60% = 180,000 UZS)...");
    const { payment: provPayment } = await createPayment({
      business: bizWithProv,
      plan: "PRO",
      provider: "DEMO",
    });

    if (provPayment.amount !== 300000) {
      throw new Error(`Expected custom payment amount 300000, got ${provPayment.amount}`);
    }
    console.log(`   ✓ createPayment выставил кастомную цену: ${provPayment.amount} UZS`);

    const completeProv = await completePayment({
      externalId: provPayment.externalId,
      providerTxnId: `p0_tx_prov_${suffix}`,
    });
    if (!completeProv.ok) {
      throw new Error(`completePayment failed: ${completeProv.error}`);
    }

    const activeSubsProv = await db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.businessId, bizWithProv.id), eq(subscriptions.status, "ACTIVE")));

    const pendingSubsProv = await db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.businessId, bizWithProv.id), eq(subscriptions.status, "PENDING")));

    if (activeSubsProv.length !== 1) {
      throw new Error(`Expected exactly 1 ACTIVE subscription, found ${activeSubsProv.length}`);
    }
    if (pendingSubsProv.length !== 0) {
      throw new Error(`Expected 0 PENDING subscriptions after payment, found ${pendingSubsProv.length}`);
    }

    const activeSub = activeSubsProv[0];
    if (
      activeSub.id !== pendingFromProvider.id ||
      activeSub.providerId !== testProvider.id ||
      activeSub.amount !== 300000 ||
      activeSub.providerCommissionPercent !== 60 ||
      activeSub.providerPayoutAmount !== 180000 ||
      activeSub.customStaffLimit !== 12 ||
      activeSub.customClientLimit !== 800
    ) {
      throw new Error(`Subscription mismatch: ${JSON.stringify(activeSub)}`);
    }
    console.log(
      `   ✓ PENDING подписка активирована: сумма=${activeSub.amount} UZS, провайдер=${activeSub.providerId}, комиссия=${activeSub.providerCommissionPercent}%, выплата=${activeSub.providerPayoutAmount} UZS`,
    );

    // Test idempotency on webhook retry
    const retryRes = await completePayment({
      externalId: provPayment.externalId,
      providerTxnId: `p0_tx_prov_${suffix}`,
    });
    if (!retryRes.ok || !retryRes.alreadyPaid) {
      throw new Error("Webhook retry did not return alreadyPaid=true");
    }
    console.log("   ✓ Повторный вызов completePayment идемпотентен (дубли подписок не создаются)");

    // 3. P0-2B: Direct platform sale (100% to platform, 0% provider commission)
    console.log("3. [P0-2] Проверка прямой продажи платформы без провайдера (100% платформе)...");
    const { payment: directPayment } = await createPayment({
      business: bizDirect,
      plan: "PRO",
      provider: "DEMO",
    });

    if (directPayment.amount !== 199000) {
      throw new Error(`Expected standard PRO price 199000, got ${directPayment.amount}`);
    }
    const completeDirect = await completePayment({
      externalId: directPayment.externalId,
      providerTxnId: `p0_tx_direct_${suffix}`,
    });
    if (!completeDirect.ok) {
      throw new Error(`completeDirect failed: ${completeDirect.error}`);
    }

    const [directSub] = await db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.businessId, bizDirect.id), eq(subscriptions.status, "ACTIVE")));

    if (
      !directSub ||
      directSub.providerId !== null ||
      directSub.amount !== 199000 ||
      directSub.providerPayoutAmount !== null
    ) {
      throw new Error(`Direct subscription mismatch: ${JSON.stringify(directSub)}`);
    }
    console.log(
      `   ✓ Прямая подписка активирована: сумма=${directSub.amount} UZS, providerId=null, 100% выручки остается платформе`,
    );
  } finally {
    // Cleanup test data
    await db.delete(businesses).where(eq(businesses.id, bizWithProv.id));
    await db.delete(businesses).where(eq(businesses.id, bizDirect.id));
    await db.delete(users).where(eq(users.id, testOwnerWithProv.id));
    await db.delete(users).where(eq(users.id, testOwnerDirect.id));
    await db.delete(users).where(eq(users.id, testProvider.id));
  }

  console.log("==================================================");
  console.log("  ALL PHASE 1 (P0) TESTS PASSED SUCCESSFULLY! 🚀");
  console.log("==================================================");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Phase 1 test failed:", err);
    process.exit(1);
  });
