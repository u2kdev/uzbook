import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../src/server/db";
import { users, businesses, clients, bookings, services, staff } from "../src/server/db/schema";
import { validateTelegramInitData } from "../src/server/telegram/webapp";
import { createBooking } from "../src/server/booking/service";

function generateTestInitData(
  params: Record<string, string>,
  botToken: string,
): string {
  const checkPairs: string[] = [];
  const searchParams = new URLSearchParams();

  for (const [k, v] of Object.entries(params)) {
    searchParams.set(k, v);
  }

  const sortedKeys = Array.from(searchParams.keys()).sort();
  for (const k of sortedKeys) {
    checkPairs.push(`${k}=${searchParams.get(k)}`);
  }

  const dataCheckString = checkPairs.join("\n");
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  const hash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  searchParams.set("hash", hash);
  return searchParams.toString();
}

async function main() {
  console.log("=== Testing Telegram Mini App (TMA) Features ===");

  const testBotToken = "123456789:ABCdefGHIjklMNOpqrSTUvwxYZ";
  const now = Math.floor(Date.now() / 1000);

  // 1. Test validateTelegramInitData with valid data
  console.log("1. Testing valid initData validation...");
  const validData = generateTestInitData(
    {
      query_id: "AAGk_test_123",
      user: JSON.stringify({
        id: 777123456,
        first_name: "Aziz",
        last_name: "Karimov",
        username: "aziz_uz",
      }),
      auth_date: String(now),
      start_param: "booking_abc",
    },
    testBotToken,
  );

  const resValid = validateTelegramInitData(validData, testBotToken);
  if (!resValid.valid) {
    throw new Error(`Expected valid initData, got error: ${resValid.error}`);
  }
  if (resValid.user?.id !== 777123456 || resValid.user?.first_name !== "Aziz") {
    throw new Error(`Parsed user mismatch: ${JSON.stringify(resValid.user)}`);
  }
  if (resValid.startParam !== "booking_abc") {
    throw new Error(`Parsed start_param mismatch: ${resValid.startParam}`);
  }
  console.log("✓ Valid initData successfully verified and parsed");

  // 2. Test tampered initData
  console.log("2. Testing tampered initData...");
  const tamperedData = validData.replace("Aziz", "Hacker");
  const resTampered = validateTelegramInitData(tamperedData, testBotToken);
  if (resTampered.valid) {
    throw new Error("Tampered initData should NOT be valid");
  }
  if (resTampered.error !== "invalid_signature") {
    throw new Error(`Expected invalid_signature error, got: ${resTampered.error}`);
  }
  console.log("✓ Tampered initData correctly rejected with invalid_signature");

  // 3. Test expired initData
  console.log("3. Testing expired initData...");
  const expiredData = generateTestInitData(
    {
      query_id: "AAGk_expired",
      user: JSON.stringify({ id: 999999, first_name: "Old" }),
      auth_date: String(now - 100000), // ~27 hours ago
    },
    testBotToken,
  );
  const resExpired = validateTelegramInitData(expiredData, testBotToken, 86400);
  if (resExpired.valid) {
    throw new Error("Expired initData should NOT be valid");
  }
  if (resExpired.error !== "init_data_expired") {
    throw new Error(`Expected init_data_expired error, got: ${resExpired.error}`);
  }
  console.log("✓ Expired initData correctly rejected with init_data_expired");

  // 4. Test booking creation with source TELEGRAM and telegramId
  console.log("4. Testing booking creation originating from Telegram Mini App...");
  const db = await getDb();
  const [biz] = await db.select().from(businesses).limit(1);
  if (!biz) throw new Error("No business found");

  const [svc] = await db.select().from(services).where(eq(services.businessId, biz.id)).limit(1);
  const [stf] = await db.select().from(staff).where(eq(staff.businessId, biz.id)).limit(1);

  if (svc && stf) {
    const bookingRes = await createBooking({
      business: biz,
      staffId: stf.id,
      serviceId: svc.id,
      startAt: new Date(Date.now() + 86400000 * 2).toISOString(),
      name: "TMA Client",
      phone: "+998901239988",
      source: "TELEGRAM",
      telegramId: "777123456",
    });

    if (bookingRes.ok) {
      const [bookingRow] = await db
        .select()
        .from(bookings)
        .where(eq(bookings.id, bookingRes.data.id))
        .limit(1);
      if (bookingRow?.source !== "TELEGRAM") {
        throw new Error(`Expected source TELEGRAM, got ${bookingRow?.source}`);
      }
      const [clientRow] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, bookingRow.clientId!))
        .limit(1);
      if (clientRow?.telegramId !== "777123456") {
        throw new Error(`Expected client.telegramId 777123456, got ${clientRow?.telegramId}`);
      }
      console.log("✓ Booking created with source: 'TELEGRAM' and client telegramId correctly saved");
    }
  }

  console.log("=== All Telegram Mini App Tests Passed! ===");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
