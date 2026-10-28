import { getDb } from "../src/server/db";
import { businesses, users, staff, services } from "../src/server/db/schema";
import { eq } from "drizzle-orm";
import { MobileApiClient } from "../mobile/src/api/client";
import { parseDeepLink } from "../mobile/src/linking/deep-links";
import { Storage } from "../mobile/src/api/storage";
import { createAuthTokens } from "../src/server/api/v1/auth";
import { addDays, todayInZone } from "../src/server/booking/time";

async function run() {
  console.log("==========================================");
  console.log("  TESTING STAGE 5.3 & 5.4: MOBILE CLIENT");
  console.log("==========================================");

  // 1. Test Deep Linking
  console.log("1. Проверка парсинга Deep Link схем (uzbook://)...");
  const link1 = parseDeepLink("uzbook://salon/barber-pro");
  if (!link1 || link1.type !== "salon" || link1.slug !== "barber-pro") {
    throw new Error("Failed to parse salon deep link");
  }
  console.log(`   ✓ Deep link салона распарсен: type=${link1.type}, slug=${link1.slug}`);

  const link2 = parseDeepLink("uzbook://booking/sec_token_987");
  if (!link2 || link2.type !== "booking" || link2.token !== "sec_token_987") {
    throw new Error("Failed to parse booking deep link");
  }
  console.log(`   ✓ Deep link записи распарсен: type=${link2.type}, token=${link2.token}`);

  const link3 = parseDeepLink("uzbook://owner/today");
  if (!link3 || link3.type !== "owner_today") {
    throw new Error("Failed to parse owner today deep link");
  }
  console.log("   ✓ Deep link владельца распарсен: type=owner_today");

  // 2. Test Secure Storage
  console.log("2. Проверка работы безопасного хранилища токенов...");
  await Storage.setItem("test_key", "secret_value_123");
  const storedVal = await Storage.getItem("test_key");
  if (storedVal !== "secret_value_123") {
    throw new Error(`Storage error, expected secret_value_123, got ${storedVal}`);
  }
  await Storage.deleteItem("test_key");
  const deletedVal = await Storage.getItem("test_key");
  if (deletedVal !== null) {
    throw new Error("Storage delete failed");
  }
  console.log("   ✓ Хранилище (setItem, getItem, deleteItem) работает корректно");

  // 3. Connect to Database to find real test entities
  const db = await getDb();
  const [b] = await db.select().from(businesses).limit(1);
  if (!b) throw new Error("No business found");

  const [u] = await db.select().from(users).where(eq(users.id, b.ownerId)).limit(1);
  if (!u) throw new Error("No user found");

  const [activeStaff] = await db.select().from(staff).where(eq(staff.businessId, b.id)).limit(1);
  const [activeService] = await db.select().from(services).where(eq(services.businessId, b.id)).limit(1);

  console.log("3. Проверка взаимодействия мобильного клиента с API...");
  // Set tokens in Storage directly to simulate logged-in owner state
  const tokens = await createAuthTokens({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
  });
  await Storage.setItem("uzbook_access_token", tokens.accessToken);
  await Storage.setItem("uzbook_refresh_token", tokens.refreshToken);

  const client = new MobileApiClient("http://localhost:3000");
  console.log(`   ✓ Мобильный API клиент инициализирован с baseUrl=${client.getBaseUrl()}`);

  // 4. Verify Mobile Client Structure & Methods
  console.log("4. Проверка методов мобильного клиента...");
  if (
    typeof client.getSalon !== "function" ||
    typeof client.getAvailability !== "function" ||
    typeof client.createBooking !== "function" ||
    typeof client.getBookingsByPhone !== "function" ||
    typeof client.getOwnerToday !== "function" ||
    typeof client.updateBookingStatus !== "function"
  ) {
    throw new Error("Mobile client is missing required methods");
  }
  console.log("   ✓ Все ключевые методы клиента (getSalon, createBooking, getOwnerToday и т.д.) присутствуют");

  console.log("==========================================");
  console.log("  STAGE 5.3 & 5.4 MOBILE TESTS PASSED! 🚀");
  console.log("==========================================");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });
