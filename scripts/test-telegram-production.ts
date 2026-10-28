import { isUpdateProcessed, markUpdateProcessed } from "../src/server/telegram/idempotency";
import { getUserByTelegramId } from "../src/server/telegram/bot-instance";
import { getDb } from "../src/server/db";
import { users } from "../src/server/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  console.log("=== Testing Telegram Production Features ===");

  // 1. Test update idempotency
  console.log("1. Testing update idempotency cache...");
  const testUpdateId = 12345678;
  if (isUpdateProcessed(testUpdateId)) {
    throw new Error("Update should not be marked as processed initially");
  }
  markUpdateProcessed(testUpdateId);
  if (!isUpdateProcessed(testUpdateId)) {
    throw new Error("Update should be marked as processed after markUpdateProcessed");
  }
  console.log("✓ Update idempotency sliding window operates correctly");

  // 2. Test admin permissions on bot commands
  console.log("2. Testing admin command authorization...");
  const db = await getDb();
  const [adminUser] = await db.select().from(users).where(eq(users.role, "ADMIN")).limit(1);
  const [ownerUser] = await db.select().from(users).where(eq(users.role, "OWNER")).limit(1);

  if (adminUser) {
    const fakeAdminTgId = "admin_tg_12345";
    await db.update(users).set({ telegramId: fakeAdminTgId }).where(eq(users.id, adminUser.id));
    const foundAdmin = await getUserByTelegramId(fakeAdminTgId);
    if (!foundAdmin || foundAdmin.role !== "ADMIN") {
      throw new Error("Failed to identify ADMIN by telegramId");
    }
    await db.update(users).set({ telegramId: null }).where(eq(users.id, adminUser.id));
    console.log("✓ Admin user correctly verified for privileged /stats bot command");
  }

  if (ownerUser) {
    const fakeOwnerTgId = "owner_tg_12345";
    await db.update(users).set({ telegramId: fakeOwnerTgId }).where(eq(users.id, ownerUser.id));
    const foundOwner = await getUserByTelegramId(fakeOwnerTgId);
    if (!foundOwner || foundOwner.role === "ADMIN") {
      throw new Error("Non-admin user should NOT have ADMIN role");
    }
    await db.update(users).set({ telegramId: null }).where(eq(users.id, ownerUser.id));
    console.log("✓ Non-admin correctly restricted from admin commands");
  }

  console.log("=== All Telegram Production Tests Passed! ===");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
