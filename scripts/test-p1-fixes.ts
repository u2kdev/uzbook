import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb } from "../src/server/db";
import { businesses, clients, trustedLogos, users } from "../src/server/db/schema";
import { findReferencedUploadNames } from "../src/server/storage/cleanup";
import { clientLimitError } from "../src/server/limits";
import { isPaymentExpired } from "../src/server/payments/expiry";

async function run() {
  console.log("==================================================");
  console.log("  TESTING PHASE 2 (P1-1 .. P1-6) REMEDIATION");
  console.log("==================================================");

  const db = await getDb();
  const suffix = Date.now();
  const passwordHash = await bcrypt.hash("testpass123", 10);

  // 1. P1-1: Trusted Logos Upload Cleanup Protection
  console.log("1. [P1-1] Проверка защиты логотипов карусели в findReferencedUploadNames()...");
  const testLogoFilename = `test-logo-${suffix}.png`;
  const [insertedLogo] = await db
    .insert(trustedLogos)
    .values({
      name: "Test Partner Logo",
      imageUrl: `/api/uploads/${testLogoFilename}`,
      linkUrl: "https://uzbook.online",
      enabled: true,
      sortOrder: 99,
    })
    .returning();

  try {
    const referenced = await findReferencedUploadNames();
    if (!referenced.has(testLogoFilename)) {
      throw new Error(`Expected ${testLogoFilename} to be in referenced uploads set`);
    }
    console.log("   ✓ Загруженные логотипы из trusted_logos учитываются и не удаляются при очистке сирот");
  } finally {
    await db.delete(trustedLogos).where(eq(trustedLogos.id, insertedLogo.id));
  }

  // 2. P1-2: Custom Client Limit Enforcement
  console.log("2. [P1-2] Проверка соблюдения лимита клиентов (customClientLimit)...");
  const [testOwner] = await db
    .insert(users)
    .values({
      email: `p1_owner_${suffix}@uzbook.test`,
      phone: `+99891${String(suffix).slice(-7)}`,
      name: "P1 Test Owner",
      passwordHash,
      role: "OWNER",
    })
    .returning();

  const [testBiz] = await db
    .insert(businesses)
    .values({
      ownerId: testOwner.id,
      name: "P1 Limit Salon",
      slug: `p1-limit-salon-${suffix}`,
      category: "beauty",
      status: "ACTIVE",
      plan: "PRO",
      customClientLimit: 2,
    })
    .returning();

  try {
    await db.insert(clients).values([
      { businessId: testBiz.id, name: "Client 1", phone: "+998901110001" },
      { businessId: testBiz.id, name: "Client 2", phone: "+998901110002" },
    ]);

    // Existing client phone should be allowed
    const existingErr = await clientLimitError(testBiz, "+998901110001");
    if (existingErr !== null) {
      throw new Error(`Expected existing client to bypass limit, got: ${existingErr}`);
    }

    // New 3rd client should be blocked
    const newClientErr = await clientLimitError(testBiz, "+998901110003");
    if (!newClientErr) {
      throw new Error("Expected 3rd client to be blocked by customClientLimit=2");
    }
    console.log(`   ✓ Лимит клиентов (customClientLimit=2) сработал: "${newClientErr}"`);
  } finally {
    await db.delete(businesses).where(eq(businesses.id, testBiz.id));
    await db.delete(users).where(eq(users.id, testOwner.id));
  }

  // 3. P1-6: Payment expiration check for PENDING status
  console.log("3. [P1-6] Проверка isPaymentExpired для статусов CREATED и PENDING...");
  const expiredTime = new Date(Date.now() - 45 * 60 * 1000);
  if (!isPaymentExpired({ status: "PENDING", createdAt: expiredTime })) {
    throw new Error("Expected PENDING payment older than 30m to be marked expired");
  }
  if (!isPaymentExpired({ status: "CREATED", createdAt: expiredTime })) {
    throw new Error("Expected CREATED payment older than 30m to be marked expired");
  }
  if (isPaymentExpired({ status: "PAID", createdAt: expiredTime })) {
    throw new Error("PAID payment must never be marked expired");
  }
  console.log("   ✓ isPaymentExpired корректно определяет истечение для CREATED и PENDING");

  console.log("==================================================");
  console.log("  ALL PHASE 2 (P1) TESTS PASSED SUCCESSFULLY! 🚀");
  console.log("==================================================");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Phase 2 test failed:", err);
    process.exit(1);
  });
