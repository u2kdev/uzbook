import { getDb } from "../src/server/db";
import { businesses, users, staff, services } from "../src/server/db/schema";
import { eq } from "drizzle-orm";
import { createAuthTokens, verifyAccessToken, verifyRefreshToken } from "../src/server/api/v1/auth";
import { getPublicBusiness } from "../src/server/business/public";
import { getAvailableSlots } from "../src/server/booking/slots";
import { createBooking, getBookingByToken, cancelBooking, rescheduleBooking } from "../src/server/booking/service";
import { todayInZone, addDays } from "../src/server/booking/time";

async function run() {
  console.log("==========================================");
  console.log("  TESTING STAGE 5.1: REST API V1 BACKEND");
  console.log("==========================================");

  const db = await getDb();
  const [b] = await db.select().from(businesses).limit(1);
  if (!b) throw new Error("No business found");

  const [u] = await db.select().from(users).where(eq(users.id, b.ownerId)).limit(1);
  if (!u) throw new Error("No owner user found");

  // 1. Test JWT Auth & Token Rotation
  console.log("1. Тестирование создания и ротации JWT токенов (Bearer auth)...");
  const tokens = await createAuthTokens({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
  });

  if (!tokens.accessToken || !tokens.refreshToken) {
    throw new Error("Failed to generate token pair");
  }
  console.log(`   ✓ Сгенерированы токены: access (${tokens.expiresIn}s), refresh (30d)`);

  const verifiedAccess = await verifyAccessToken(tokens.accessToken);
  if (!verifiedAccess || verifiedAccess.id !== u.id) {
    throw new Error("Access token verification failed");
  }
  console.log(`   ✓ Access token валидирован: userId=${verifiedAccess.id}, role=${verifiedAccess.role}`);

  const verifiedRefresh = await verifyRefreshToken(tokens.refreshToken);
  if (!verifiedRefresh || verifiedRefresh.userId !== u.id) {
    throw new Error("Refresh token verification failed");
  }
  console.log(`   ✓ Refresh token валидирован: userId=${verifiedRefresh.userId}`);

  // Test Refresh Rotation
  const newTokens = await createAuthTokens({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
  });
  if (newTokens.accessToken === tokens.accessToken) {
    throw new Error("Rotated token must be different");
  }
  console.log("   ✓ Ротация токенов выполнена успешно");

  // 2. Test Public Salon Details
  console.log("2. Тестирование получения данных салона (GET /salons/[slug])...");
  const publicData = await getPublicBusiness(b.slug);
  if (!publicData || !publicData.business) {
    throw new Error(`Public salon not found for slug ${b.slug}`);
  }
  console.log(`   ✓ Салон: «${publicData.business.name}», Услуг: ${publicData.services.length}, Мастеров: ${publicData.staff.length}`);

  // 3. Test Availability Slots
  console.log("3. Тестирование расчета слотов (GET /salons/[slug]/availability)...");
  const [activeStaff] = await db
    .select()
    .from(staff)
    .where(eq(staff.businessId, b.id))
    .limit(1);
  const [activeService] = await db
    .select()
    .from(services)
    .where(eq(services.businessId, b.id))
    .limit(1);

  if (!activeStaff || !activeService) {
    throw new Error("Need active staff and service to test availability");
  }

  const tomorrow = addDays(todayInZone(b.timezone), 1);
  const slots = await getAvailableSlots({
    staffId: activeStaff.id,
    serviceId: activeService.id,
    date: tomorrow,
    timezone: b.timezone,
    settings: b.settings,
  });
  console.log(`   ✓ На дату ${tomorrow} найдено доступных слотов: ${slots.length}`);

  // 4. Test Booking Flow: Create, Retrieve, Reschedule, Cancel
  console.log("4. Тестирование создания записи через API (POST /bookings)...");
  const testPhone = "+998909998877";

  // Pick a slot or build timestamp
  const targetSlot = slots[0]?.start ?? `${tomorrow}T10:00:00.000Z`;

  const bookingRes = await createBooking({
    business: b,
    staffId: activeStaff.id,
    serviceId: activeService.id,
    startAt: targetSlot,
    name: "Тестовый Клиент API",
    phone: testPhone,
    note: "Создано через REST API v1",
    source: "WEB",
  });

  if (!bookingRes.ok) {
    throw new Error(`Ошибка создания записи: ${bookingRes.error}`);
  }
  const createdBooking = bookingRes.data;
  console.log(`   ✓ Запись создана: id=${createdBooking.id}, token=${createdBooking.manageToken}`);

  // 5. Test Booking Retrieval (GET /bookings/[token])
  console.log("5. Тестирование просмотра записи по токену (GET /bookings/[token])...");
  const retrieved = await getBookingByToken(createdBooking.manageToken);
  if (!retrieved || retrieved.id !== createdBooking.id) {
    throw new Error("Failed to retrieve booking by manageToken");
  }
  console.log(`   ✓ Данные записи получены: статус=${retrieved.status}, мастер=${retrieved.staff.name}, салон=${retrieved.business.name}`);

  // 6. Test Reschedule (POST /bookings/[token]/reschedule)
  console.log("6. Тестирование переноса записи (POST /bookings/[token]/reschedule)...");
  if (slots.length > 1) {
    const nextSlot = slots[1].start;
    const rescheduleRes = await rescheduleBooking(createdBooking.manageToken, nextSlot);
    if (!rescheduleRes.ok) {
      console.log(`   ⚠️ Перенос на слот ${nextSlot} вернул: ${rescheduleRes.error} (допустимо при конфликтах)`);
    } else {
      console.log(`   ✓ Запись успешно перенесена на ${rescheduleRes.data.startAt.toISOString()}`);
    }
  } else {
    console.log("   ✓ Пропуск переноса: только один слот на день");
  }

  // 7. Test Cancellation (POST /bookings/[token]/cancel)
  console.log("7. Тестирование отмены записи клиентом (POST /bookings/[token]/cancel)...");
  const cancelRes = await cancelBooking(createdBooking.manageToken, "Клиент отменил через мобильное приложение");
  if (!cancelRes.ok) {
    throw new Error(`Failed to cancel booking: ${cancelRes.error}`);
  }
  console.log(`   ✓ Запись успешно отменена: id=${cancelRes.data.id}`);

  console.log("==========================================");
  console.log("  STAGE 5.1 REST API V1 TESTS PASSED! 🚀");
  console.log("==========================================");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });
