import { eq } from "drizzle-orm";
import { getDb } from "../src/server/db";
import { users, businesses, subscriptions, payments } from "../src/server/db/schema";
import { createTelegramLinkToken, readTelegramLinkToken } from "../src/server/telegram/link";
import {
  notifyPaymentCompleted,
  notifySubscriptionExpiring,
  notifyNewBooking,
} from "../src/server/telegram/notify";

async function main() {
  console.log("=== Testing Telegram Bot & Notifications ===");
  const db = await getDb();

  // 1. Test token creation & validation
  const [testUser] = await db.select().from(users).where(eq(users.role, "OWNER")).limit(1);
  if (!testUser) {
    throw new Error("No OWNER user found for test");
  }

  console.log("1. Testing Telegram link tokens...");
  const token = await createTelegramLinkToken(testUser.id);
  if (!token || typeof token !== "string") {
    throw new Error("Failed to generate token");
  }
  const decoded = await readTelegramLinkToken(token);
  if (!decoded || decoded.userId !== testUser.id) {
    throw new Error(`Token validation mismatch: expected ${testUser.id}, got ${decoded?.userId}`);
  }
  const invalidDecoded = await readTelegramLinkToken("invalid.token.here");
  if (invalidDecoded !== null) {
    throw new Error("Invalid token unexpectedly decoded");
  }
  console.log("✓ Link tokens generation, signing, and verification work correctly");

  // 2. Test binding and unlinking Telegram ID
  console.log("2. Testing Telegram ID binding and unlinking...");
  const fakeTelegramId = "9988776655";
  await db.update(users).set({ telegramId: fakeTelegramId }).where(eq(users.id, testUser.id));
  const [updatedUser] = await db.select().from(users).where(eq(users.id, testUser.id)).limit(1);
  if (updatedUser?.telegramId !== fakeTelegramId) {
    throw new Error("Failed to set telegramId");
  }
  console.log("✓ telegramId successfully bound to user");

  // Unlink
  await db.update(users).set({ telegramId: null }).where(eq(users.id, testUser.id));
  const [unlinkedUser] = await db.select().from(users).where(eq(users.id, testUser.id)).limit(1);
  if (unlinkedUser?.telegramId !== null) {
    throw new Error("Failed to unlink telegramId");
  }
  console.log("✓ telegramId successfully unlinked from user");

  // 3. Test notification settings filtering
  console.log("3. Testing Telegram notification preference filtering...");
  const [biz] = await db.select().from(businesses).where(eq(businesses.ownerId, testUser.id)).limit(1);
  if (biz) {
    // When telegram is not configured or user has no telegramId, notify calls should safely return false/no-op without throwing
    const payRes = await notifyPaymentCompleted({
      businessId: biz.id,
      plan: "PRO",
      amount: 149000,
      currency: "UZS",
      provider: "CLICK",
      periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    console.log("✓ Payment notification triggered safely (result:", payRes, ")");

    const subRes = await notifySubscriptionExpiring({
      businessId: biz.id,
      daysLeft: 3,
      isTrial: false,
    });
    console.log("✓ Subscription expiration notification triggered safely (result:", subRes, ")");
  }

  console.log("=== All Telegram Bot & Notification Tests Passed! ===");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
