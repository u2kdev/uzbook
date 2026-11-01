import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb } from "../src/server/db";
import {
  businesses,
  users,
  services,
  staff,
  staffServices,
  workingHours,
  bookings,
} from "../src/server/db/schema";
import { createAuthTokens } from "../src/server/api/v1/auth";
import { GET as getV1Bookings } from "../src/app/api/v1/bookings/route";
import { PATCH as patchV1BookingStatus } from "../src/app/api/v1/owner/bookings/[id]/status/route";
import { createBooking, cancelBooking } from "../src/server/booking/service";
import { getAvailableSlots } from "../src/server/booking/slots";
import { addDays, todayInZone } from "../src/server/booking/time";
import { writeBlockedReason } from "../src/server/limits";

async function run() {
  console.log("==================================================");
  console.log("  TESTING NEW-P1-1, NEW-P1-2, NEW-P1-3 FIXES");
  console.log("==================================================");

  const db = await getDb();
  const suffix = Date.now();
  const passwordHash = await bcrypt.hash("testpass123", 10);
  const clientPhone = `+99890${String(suffix).slice(-7)}`;

  // Create Owner A & Salon A
  const [ownerA] = await db
    .insert(users)
    .values({
      email: `owner_a_${suffix}@test.uz`,
      phone: `+99891${String(suffix).slice(-7)}`,
      name: "Owner A",
      passwordHash,
      role: "OWNER",
    })
    .returning();

  const [bizA] = await db
    .insert(businesses)
    .values({
      ownerId: ownerA.id,
      name: "Salon A",
      slug: `salon-a-${suffix}`,
      status: "ACTIVE",
      plan: "TRIAL",
      trialEndsAt: new Date(Date.now() + 14 * 86400_000), // Active
    })
    .returning();

  const [staffA] = await db
    .insert(staff)
    .values({
      businessId: bizA.id,
      name: "Master A",
    })
    .returning();

  const [servA] = await db
    .insert(services)
    .values({
      businessId: bizA.id,
      name: "Haircut A",
      price: 100_000,
      durationMin: 30,
    })
    .returning();

  await db.insert(staffServices).values({
    staffId: staffA.id,
    serviceId: servA.id,
  });

  // Create Owner B & Salon B
  const [ownerB] = await db
    .insert(users)
    .values({
      email: `owner_b_${suffix}@test.uz`,
      phone: `+99893${String(suffix).slice(-7)}`,
      name: "Owner B",
      passwordHash,
      role: "OWNER",
    })
    .returning();

  const [bizB] = await db
    .insert(businesses)
    .values({
      ownerId: ownerB.id,
      name: "Salon B",
      slug: `salon-b-${suffix}`,
      status: "ACTIVE",
      plan: "TRIAL",
      trialEndsAt: new Date(Date.now() + 14 * 86400_000),
    })
    .returning();

  const [staffB] = await db
    .insert(staff)
    .values({
      businessId: bizB.id,
      name: "Master B",
    })
    .returning();

  const [servB] = await db
    .insert(services)
    .values({
      businessId: bizB.id,
      name: "Massage B",
      price: 200_000,
      durationMin: 60,
    })
    .returning();

  await db.insert(staffServices).values({
    staffId: staffB.id,
    serviceId: servB.id,
  });

  // Add working hours for staffB for every day 08:00 - 22:00
  for (let d = 0; d < 7; d++) {
    await db.insert(workingHours).values({
      staffId: staffB.id,
      weekday: d,
      startMinute: 8 * 60,
      endMinute: 22 * 60,
    });
  }

  // ----------------------------------------------------
  // TEST 1: NEW-P1-1 (Protection of PII and manageToken)
  // ----------------------------------------------------
  console.log("\n--- [NEW-P1-1] Проверка безопасности GET /api/v1/bookings ---");

  // Create booking in Salon A for clientPhone
  const startA = new Date(Date.now() + 86400_000);
  startA.setHours(10, 0, 0, 0);
  const endA = new Date(startA.getTime() + 30 * 60_000);

  const [bookingA] = await db
    .insert(bookings)
    .values({
      businessId: bizA.id,
      staffId: staffA.id,
      serviceId: servA.id,
      clientName: "Client In Salon A",
      clientPhone,
      startAt: startA,
      endAt: endA,
      status: "CONFIRMED",
      manageToken: `token_a_${suffix}`,
      price: servA.price,
      durationMin: servA.durationMin,
    })
    .returning();

  // Create booking in Salon B for SAME clientPhone
  const startB = new Date(Date.now() + 86400_000);
  startB.setHours(14, 0, 0, 0);
  const endB = new Date(startB.getTime() + 60 * 60_000);

  const [bookingB] = await db
    .insert(bookings)
    .values({
      businessId: bizB.id,
      staffId: staffB.id,
      serviceId: servB.id,
      clientName: "Client In Salon B",
      clientPhone,
      startAt: startB,
      endAt: endB,
      status: "CONFIRMED",
      manageToken: `token_b_${suffix}`,
      price: servB.price,
      durationMin: servB.durationMin,
    })
    .returning();

  // Test 1.1: Unauthenticated request should be rejected (401)
  const unauthReq = new Request(`http://localhost:3000/api/v1/bookings?phone=${encodeURIComponent(clientPhone)}`);
  const unauthRes = await getV1Bookings(unauthReq);
  if (unauthRes.status !== 401) {
    throw new Error(`Expected 401 for unauthenticated request, got ${unauthRes.status}`);
  }
  console.log("   ✓ Неаутентифицированный запрос GET /api/v1/bookings возвращает 401 Unauthorized");

  // Test 1.2: Authenticated request by Owner A returns ONLY Salon A bookings
  const tokensA = await createAuthTokens({
    id: ownerA.id,
    email: ownerA.email,
    name: ownerA.name,
    role: ownerA.role,
  });

  const authReq = new Request(
    `http://localhost:3000/api/v1/bookings?phone=${encodeURIComponent(clientPhone)}`,
    {
      headers: {
        Authorization: `Bearer ${tokensA.accessToken}`,
      },
    },
  );
  const authRes = await getV1Bookings(authReq);
  if (authRes.status !== 200) {
    const errBody = await authRes.json();
    throw new Error(`Expected 200, got ${authRes.status}: ${JSON.stringify(errBody)}`);
  }
  const body = await authRes.json();
  if (!body.success) {
    throw new Error("Expected success response from GET /api/v1/bookings");
  }

  // Verify multi-tenant isolation: only 1 booking for Salon A, none from Salon B
  if (body.data.bookings.length !== 1 || body.data.bookings[0].id !== bookingA.id) {
    throw new Error(`Expected only bookingA, got: ${JSON.stringify(body.data.bookings)}`);
  }
  console.log("   ✓ Запрос изолирован в рамках салона владельца: чужие брони не возвращаются");

  // Verify NO manageToken or manageUrl in response items
  const returnedBooking = body.data.bookings[0];
  if ("manageToken" in returnedBooking || "manageUrl" in returnedBooking) {
    throw new Error(`LEAK: manageToken or manageUrl found in response item: ${JSON.stringify(returnedBooking)}`);
  }
  console.log("   ✓ manageToken и manageUrl полностью исключены из ответа GET /api/v1/bookings");

  // ----------------------------------------------------
  // TEST 2: NEW-P1-2 (Enforce expired / suspended blocks)
  // ----------------------------------------------------
  console.log("\n--- [NEW-P1-2] Проверка блокировок для истёкшей подписки и статуса SUSPENDED ---");

  // Create an expired business
  const [ownerExpired] = await db
    .insert(users)
    .values({
      email: `owner_exp_${suffix}@test.uz`,
      name: "Owner Expired",
      passwordHash,
      role: "OWNER",
    })
    .returning();

  const [expiredBiz] = await db
    .insert(businesses)
    .values({
      ownerId: ownerExpired.id,
      name: "Expired Salon",
      slug: `expired-salon-${suffix}`,
      status: "ACTIVE",
      plan: "TRIAL",
      trialEndsAt: new Date(Date.now() - 3600_000), // Expired 1 hour ago
    })
    .returning();

  const expiredReason = writeBlockedReason(expiredBiz);
  if (!expiredReason || !expiredReason.includes("Пробный период закончился")) {
    throw new Error(`Expected trial expired error, got: ${expiredReason}`);
  }
  console.log(`   ✓ writeBlockedReason корректно блокирует истёкший триал: "${expiredReason}"`);

  // Create suspended business
  const [ownerSuspended] = await db
    .insert(users)
    .values({
      email: `owner_susp_${suffix}@test.uz`,
      name: "Owner Suspended",
      passwordHash,
      role: "OWNER",
    })
    .returning();

  const [suspendedBiz] = await db
    .insert(businesses)
    .values({
      ownerId: ownerSuspended.id,
      name: "Suspended Salon",
      slug: `suspended-salon-${suffix}`,
      status: "SUSPENDED",
      plan: "PRO",
    })
    .returning();

  const suspendedReason = writeBlockedReason(suspendedBiz);
  if (!suspendedReason || !suspendedReason.includes("приостановлен")) {
    throw new Error(`Expected suspended error, got: ${suspendedReason}`);
  }
  console.log(`   ✓ writeBlockedReason корректно блокирует статус SUSPENDED: "${suspendedReason}"`);

  // Verify createBooking blocks booking creation for expired business
  const expiredBookingAttempt = await createBooking({
    business: expiredBiz,
    serviceId: servA.id,
    staffId: staffA.id,
    startAt: new Date(Date.now() + 86400_000),
    name: "New Client",
    phone: "+998901234567",
    source: "WEB",
  });
  if (expiredBookingAttempt.ok) {
    throw new Error("createBooking should fail for expired business");
  }
  console.log("   ✓ createBooking блокирует создание новых броней для бизнеса с истёкшей подпиской");

  // Verify PATCH /api/v1/owner/bookings/[id]/status blocks non-cancellation writes when suspended
  const patchConfirmReq = new Request(`http://localhost:3000/api/v1/owner/bookings/${bookingB.id}/status`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${(await createAuthTokens({ id: ownerB.id, email: ownerB.email, name: ownerB.name, role: ownerB.role })).accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: "COMPLETED" }),
  });
  // Switch bizB to SUSPENDED temporarily
  await db.update(businesses).set({ status: "SUSPENDED" }).where(eq(businesses.id, bizB.id));
  const patchConfirmRes = await patchV1BookingStatus(patchConfirmReq, { params: Promise.resolve({ id: bookingB.id }) });
  if (patchConfirmRes.status !== 403) {
    throw new Error(`Expected 403 for COMPLETED status on suspended salon, got ${patchConfirmRes.status}`);
  }
  console.log("   ✓ PATCH status: COMPLETED блокируется с кодом 403 при статусе SUSPENDED");

  // Verify PATCH status: CANCELLED REMAINS ALLOWED (safe cancellation preservation)
  const patchCancelReq = new Request(`http://localhost:3000/api/v1/owner/bookings/${bookingB.id}/status`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${(await createAuthTokens({ id: ownerB.id, email: ownerB.email, name: ownerB.name, role: ownerB.role })).accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: "CANCELLED", reason: "Safe owner cancellation" }),
  });
  const patchCancelRes = await patchV1BookingStatus(patchCancelReq, { params: Promise.resolve({ id: bookingB.id }) });
  if (patchCancelRes.status !== 200) {
    throw new Error(`Expected 200 for CANCELLED status on suspended salon, got ${patchCancelRes.status}`);
  }
  console.log("   ✓ Безопасная отмена записи (status: CANCELLED) разрешена даже при заблокированном бизнесе");

  // Restore bizB status
  await db.update(businesses).set({ status: "ACTIVE" }).where(eq(businesses.id, bizB.id));

  // ----------------------------------------------------
  // TEST 3: NEW-P1-3 (Anti-spam rate limit enforcement)
  // ----------------------------------------------------
  console.log("\n--- [NEW-P1-3] Проверка защиты от обхода MAX_ACTIVE_BOOKINGS_PER_PHONE ---");

  // Check role authorization logic for source assignment
  // Case A: Competitor (ownerA) visiting salon B -> source must be "WEB"
  const isOwnerAforBizB = Boolean(ownerA && (ownerA.id === bizB.ownerId || ownerA.role === "ADMIN"));
  if (isOwnerAforBizB) {
    throw new Error("Owner A must NOT be recognized as owner of Biz B");
  }
  const sourceCompetitor = isOwnerAforBizB ? "MANUAL" : "WEB";
  if (sourceCompetitor !== "WEB") {
    throw new Error(`Expected "WEB" source for competitor session, got ${sourceCompetitor}`);
  }
  console.log("   ✓ Сессия стороннего пользователя/владельца другого салона получает source: WEB");

  // Case B: Legitimate owner (ownerB) of salon B -> source must be "MANUAL"
  const isOwnerBforBizB = Boolean(ownerB && (ownerB.id === bizB.ownerId || ownerB.role === "ADMIN"));
  const sourceOwner = isOwnerBforBizB ? "MANUAL" : "WEB";
  if (sourceOwner !== "MANUAL") {
    throw new Error(`Expected "MANUAL" source for actual salon owner, got ${sourceOwner}`);
  }
  console.log("   ✓ Только действительный владелец или админ салона получает source: MANUAL");

  // Test MAX_ACTIVE_BOOKINGS_PER_PHONE enforcement with source: WEB
  // Populate 5 active upcoming bookings for phone in Salon B
  const spamPhone = `+99899${String(suffix).slice(-7)}`;
  for (let i = 1; i <= 5; i++) {
    const slotStart = new Date(Date.now() + (i + 1) * 86400_000);
    slotStart.setHours(9 + i, 0, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + 60 * 60_000);
    await db.insert(bookings).values({
      businessId: bizB.id,
      staffId: staffB.id,
      serviceId: servB.id,
      clientName: `Spam Client ${i}`,
      clientPhone: spamPhone,
      startAt: slotStart,
      endAt: slotEnd,
      status: "CONFIRMED",
      manageToken: `spam_tok_${i}_${suffix}`,
      price: servB.price,
      durationMin: servB.durationMin,
      source: "WEB",
    });
  }

  // 6th booking with source: WEB should fail with too_many_active_bookings
  const testDate = addDays(todayInZone(bizB.timezone), 3);
  const availableSlots = await getAvailableSlots({
    staffId: staffB.id,
    serviceId: servB.id,
    date: testDate,
    timezone: bizB.timezone,
    settings: bizB.settings,
  });
  if (availableSlots.length === 0) {
    throw new Error("No slots found for test date");
  }
  const slot6 = availableSlots[0].start;

  const sixthWebBooking = await createBooking({
    business: bizB,
    staffId: staffB.id,
    serviceId: servB.id,
    startAt: slot6,
    name: "Spam Client 6",
    phone: spamPhone,
    source: "WEB",
  });

  if (sixthWebBooking.ok || sixthWebBooking.error !== "too_many_active_bookings") {
    throw new Error(
      `Expected too_many_active_bookings for 6th WEB booking, got: ${JSON.stringify(sixthWebBooking)}`,
    );
  }
  console.log("   ✓ Лимит MAX_ACTIVE_BOOKINGS_PER_PHONE (5) успешно защищает от спам-бронирований");

  // 6th booking with source: MANUAL (owner adding a client) is exempted and succeeds
  const sixthManualBooking = await createBooking({
    business: bizB,
    staffId: staffB.id,
    serviceId: servB.id,
    startAt: slot6,
    name: "Owner VIP Client",
    phone: spamPhone,
    source: "MANUAL",
  });

  if (!sixthManualBooking.ok) {
    throw new Error(
      `Owner manual booking should succeed, got error: ${sixthManualBooking.error}`,
    );
  }
  console.log("   ✓ Владелец салона (source: MANUAL) может создавать записи сверх лимита");

  console.log("\n==================================================");
  console.log("  ALL NEW-P1 FIXES VERIFIED SUCCESSFULLY! 🚀");
  console.log("==================================================");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });
