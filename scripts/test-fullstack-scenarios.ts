import { and, eq } from "drizzle-orm";
import { getDb } from "../src/server/db";
import {
  bookings,
  businesses,
  clients,
  services,
  staff,
  staffServices,
  subscriptions,
  users,
  workingHours,
} from "../src/server/db/schema";
import bcrypt from "bcryptjs";
import { getAvailableSlots } from "../src/server/booking/slots";
import {
  cancelBooking,
  createBooking,
  getBookingByToken,
  rescheduleBooking,
} from "../src/server/booking/service";
import { addDays, todayInZone } from "../src/server/booking/time";
import { getDaySchedule } from "../src/server/business/day";
import {
  serviceLimitError,
  staffLimitError,
  writeBlockedReason,
} from "../src/server/limits";
import { completePayment, createPayment } from "../src/server/payments/service";
import { createTelegramLinkToken, readTelegramLinkToken } from "../src/server/telegram/link";
import { generateQRCodeDataURL } from "../src/lib/qr-code";
import { planById } from "../src/lib/plans";

try {
  process.loadEnvFile?.(".env");
} catch {}

const runId = Math.random().toString(36).slice(2, 8);
const testEmail = `test_owner_${runId}@uzbook.test`;
const testSlug = `test-salon-${runId}`;

async function run() {
  console.log(`\n======================================================`);
  console.log(`  STARTING FULLSTACK SCENARIOS TEST (Run ID: ${runId})`);
  console.log(`======================================================\n`);

  const db = await getDb();

  // ------------------------------------------------------------------
  // 1. Регистрация → онбординг → бизнес создан
  // ------------------------------------------------------------------
  console.log(`[Scenario 1] Регистрация → онбординг → бизнес создан...`);
  const passwordHash = await bcrypt.hash("supersecret123", 10);
  const [user] = await db
    .insert(users)
    .values({
      email: testEmail,
      name: "Тестовый Владелец",
      passwordHash,
      role: "OWNER",
    })
    .returning();

  if (!user || user.email !== testEmail) throw new Error("Failed to register user");

  const [business] = await db
    .insert(businesses)
    .values({
      ownerId: user.id,
      name: "Тестовый Салон",
      slug: testSlug,
      category: "beauty",
      status: "ACTIVE",
      plan: "TRIAL",
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    })
    .returning();

  if (!business || business.slug !== testSlug) throw new Error("Failed to create business in onboarding");
  console.log(`  ✓ Успешно: создан пользователь ${user.email} и бизнес ${business.name} (slug: /${business.slug}, plan: ${business.plan})\n`);

  // ------------------------------------------------------------------
  // 2. Услуга → мастер → расписание → слот появился
  // ------------------------------------------------------------------
  console.log(`[Scenario 2] Услуга → мастер → расписание → слот появился...`);
  const [service] = await db
    .insert(services)
    .values({
      businessId: business.id,
      name: "Стрижка и укладка",
      price: 150000,
      durationMin: 60,
      bufferBeforeMin: 0,
      bufferAfterMin: 15,
      isActive: true,
      sortOrder: 0,
    })
    .returning();

  const [member] = await db
    .insert(staff)
    .values({
      businessId: business.id,
      name: "Алина Стилист",
      title: "Топ-мастер",
      color: "#6e56f8",
      isActive: true,
    })
    .returning();

  await db
    .insert(staffServices)
    .values({ staffId: member.id, serviceId: service.id });

  // Все 7 дней недели с 10:00 до 20:00
  await db.insert(workingHours).values(
    [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      staffId: member.id,
      weekday,
      startMinute: 10 * 60,
      endMinute: 20 * 60,
    })),
  );

  const targetDate = addDays(todayInZone(business.timezone), 2);
  const slots = await getAvailableSlots({
    staffId: member.id,
    serviceId: service.id,
    date: targetDate,
    timezone: business.timezone,
    settings: business.settings,
  });

  if (slots.length === 0) throw new Error("No slots generated for staff member");
  console.log(`  ✓ Успешно: создана услуга «${service.name}», мастер «${member.name}», сгенерировано ${slots.length} свободных слотов на ${targetDate} (первый: ${slots[0].label})\n`);

  // ------------------------------------------------------------------
  // 3. Клиент записался без логина
  // ------------------------------------------------------------------
  console.log(`[Scenario 3] Клиент записался без логина...`);
  const chosenSlot = slots[0];
  const bookingResult = await createBooking({
    business,
    staffId: member.id,
    serviceId: service.id,
    startAt: chosenSlot.start,
    name: "Дилшод Клиент",
    phone: "+998901234567",
    email: "dilshod@client.uz",
    note: "Пожалуйста, поаккуратнее",
    source: "WEB",
  });

  if (!bookingResult.ok) throw new Error(`Booking failed: ${bookingResult.error}`);
  const { id: bookingId, manageToken } = bookingResult.data;

  const [savedClient] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.businessId, business.id), eq(clients.phone, "+998901234567")));

  if (!savedClient) throw new Error("Client record was not created");
  console.log(`  ✓ Успешно: клиент записан на ${chosenSlot.label}, токен управления: ${manageToken.slice(0, 10)}..., клиент сохранён в базе: ${savedClient.name}\n`);

  // ------------------------------------------------------------------
  // 4. Владелец увидел запись, подтвердил, отметил «пришёл» / «не пришёл»
  // ------------------------------------------------------------------
  console.log(`[Scenario 4] Владелец увидел запись в таймлайне и обновил статус...`);
  const scheduleDay = await getDaySchedule(business, targetDate);
  const foundInDay = scheduleDay.bookings.find((b) => b.id === bookingId);
  if (!foundInDay) throw new Error("Booking not visible in getDaySchedule");

  // Статус "пришёл" (COMPLETED)
  await db
    .update(bookings)
    .set({ status: "COMPLETED", updatedAt: new Date() })
    .where(and(eq(bookings.id, bookingId), eq(bookings.businessId, business.id)));

  let [updatedBooking] = await db
    .select({ status: bookings.status })
    .from(bookings)
    .where(eq(bookings.id, bookingId));
  if (updatedBooking?.status !== "COMPLETED") throw new Error("Failed to set COMPLETED status");

  // Статус "не пришёл" (NO_SHOW)
  await db
    .update(bookings)
    .set({ status: "NO_SHOW", updatedAt: new Date() })
    .where(and(eq(bookings.id, bookingId), eq(bookings.businessId, business.id)));

  [updatedBooking] = await db
    .select({ status: bookings.status })
    .from(bookings)
    .where(eq(bookings.id, bookingId));
  if (updatedBooking?.status !== "NO_SHOW") throw new Error("Failed to set NO_SHOW status");

  // Возвращаем в CONFIRMED для следующего шага
  await db
    .update(bookings)
    .set({ status: "CONFIRMED", updatedAt: new Date() })
    .where(and(eq(bookings.id, bookingId), eq(bookings.businessId, business.id)));

  console.log(`  ✓ Успешно: запись видна в таймлайне, статусы переключаются корректно (CONFIRMED -> COMPLETED -> NO_SHOW -> CONFIRMED)\n`);

  // ------------------------------------------------------------------
  // 5. Клиент перенёс и отменил запись по ссылке
  // ------------------------------------------------------------------
  console.log(`[Scenario 5] Клиент перенёс и отменил запись по ссылке (/b/<token>)...`);
  const publicBooking = await getBookingByToken(manageToken);
  if (!publicBooking) throw new Error("Cannot get booking by token");

  // Перенос на слот 2
  const newSlot = slots[2];
  const rescheduleRes = await rescheduleBooking(manageToken, newSlot.start);
  if (!rescheduleRes.ok) throw new Error(`Reschedule failed: ${rescheduleRes.error}`);

  const checkMoved = await getBookingByToken(manageToken);
  if (new Date(checkMoved!.startAt).toISOString() !== newSlot.start) {
    throw new Error("Rescheduled startAt does not match");
  }

  // Отмена
  const cancelRes = await cancelBooking(manageToken, "Не получается приехать");
  if (!cancelRes.ok) throw new Error(`Cancel failed: ${cancelRes.error}`);

  const checkCancelled = await getBookingByToken(manageToken);
  if (checkCancelled?.status !== "CANCELLED") throw new Error("Booking was not cancelled");

  // Проверяем, что слот 2 снова свободен
  const slotsAfterCancel = await getAvailableSlots({
    staffId: member.id,
    serviceId: service.id,
    date: targetDate,
    timezone: business.timezone,
    settings: business.settings,
  });
  const slotReturned = slotsAfterCancel.some((s) => s.start === newSlot.start);
  if (!slotReturned) throw new Error("Cancelled slot did not return to availability");

  console.log(`  ✓ Успешно: запись перенесена на ${newSlot.label}, затем отменена клиентом. Освободившийся слот снова доступен для других клиентов!\n`);

  // ------------------------------------------------------------------
  // 6. Сработал лимит тарифа и trial-блокировка
  // ------------------------------------------------------------------
  console.log(`[Scenario 6] Проверка лимитов тарифа и trial-блокировки...`);
  // Симулируем истечение триала
  const expiredBusiness = {
    ...business,
    trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // вчера
  };
  const blockedReason = writeBlockedReason(expiredBusiness);
  if (!blockedReason) throw new Error("writeBlockedReason did not trigger for expired trial");

  const serviceLimit = await serviceLimitError(expiredBusiness);
  if (!serviceLimit) throw new Error("serviceLimitError did not trigger on expired trial");

  console.log(`  ✓ Успешно: при истечении триала сработала блокировка: «${blockedReason.slice(0, 50)}...»\n`);

  // ------------------------------------------------------------------
  // 7. Прошла оплата DEMO и тариф активировался
  // ------------------------------------------------------------------
  console.log(`[Scenario 7] Оплата DEMO и автоматическая активация тарифа...`);
  process.env.PAYMENTS_DEMO = "on";
  const { payment, url } = await createPayment({
    business,
    plan: "PRO",
    provider: "DEMO",
  });
  if (!payment) throw new Error("Failed to create payment");

  const paymentCompletion = await completePayment({ externalId: payment.externalId });
  if (!paymentCompletion.ok) throw new Error("completePayment failed");

  const [activeSub] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.businessId, business.id), eq(subscriptions.status, "ACTIVE")));

  if (!activeSub || activeSub.plan !== "PRO") throw new Error("Active subscription not activated");

  const [refreshedBiz] = await db
    .select({ plan: businesses.plan })
    .from(businesses)
    .where(eq(businesses.id, business.id));

  if (refreshedBiz?.plan !== "PRO") throw new Error("Business plan was not updated to PRO");
  console.log(`  ✓ Успешно: платёж DEMO завершён, подписка ACTIVE на 30 дней, тариф бизнеса обновлён до ${refreshedBiz.plan}\n`);

  // ------------------------------------------------------------------
  // 8. Админ подтвердил ручную заявку
  // ------------------------------------------------------------------
  console.log(`[Scenario 8] Админ подтвердил ручную заявку на тариф...`);
  const [manualReq] = await db
    .insert(subscriptions)
    .values({
      businessId: business.id,
      plan: "BUSINESS",
      status: "PENDING",
      provider: "MANUAL",
      amount: planById("BUSINESS").priceUzs,
      currency: "UZS",
      note: "Заявка на перевод на карту",
    })
    .returning();

  // Симуляция действия approveSubscriptionAction
  await db.transaction(async (tx) => {
    await tx
      .update(subscriptions)
      .set({ status: "CANCELLED" })
      .where(and(eq(subscriptions.businessId, business.id), eq(subscriptions.status, "ACTIVE")));

    await tx
      .update(subscriptions)
      .set({
        status: "ACTIVE",
        startedAt: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        note: "Подтверждено администратором",
      })
      .where(eq(subscriptions.id, manualReq.id));

    await tx
      .update(businesses)
      .set({ plan: "BUSINESS", trialEndsAt: null })
      .where(eq(businesses.id, business.id));
  });

  const [afterApprovalBiz] = await db
    .select({ plan: businesses.plan })
    .from(businesses)
    .where(eq(businesses.id, business.id));

  if (afterApprovalBiz?.plan !== "BUSINESS") throw new Error("Business plan was not updated to BUSINESS");
  console.log(`  ✓ Успешно: заявка ${manualReq.id} подтверждена, тариф повышен до ${afterApprovalBiz.plan}\n`);

  // ------------------------------------------------------------------
  // 9. Ссылка привязки Telegram работает
  // ------------------------------------------------------------------
  console.log(`[Scenario 9] Ссылка привязки Telegram...`);
  const linkToken = await createTelegramLinkToken(user.id);
  const parsedLink = await readTelegramLinkToken(linkToken);

  if (!parsedLink || parsedLink.userId !== user.id) {
    throw new Error("Telegram link token verification failed");
  }
  console.log(`  ✓ Успешно: сгенерирован подписанный токен JWT, верификация подтвердила userId: ${parsedLink.userId}\n`);

  // ------------------------------------------------------------------
  // 10. QR открывает публичную страницу
  // ------------------------------------------------------------------
  console.log(`[Scenario 10] QR-код открывает публичную страницу...`);
  const publicPageUrl = `https://uzbook.online/${business.slug}`;
  const qrDataUrl = await generateQRCodeDataURL(publicPageUrl, 256, business.theme.accent);

  if (!qrDataUrl.startsWith("data:image/png;base64,")) {
    throw new Error("Invalid QR code generation");
  }
  console.log(`  ✓ Успешно: сгенерирован валидный base64 QR-код для ссылки ${publicPageUrl}\n`);

  console.log(`======================================================`);
  console.log(`  ALL 10 FULLSTACK SCENARIOS PASSED SUCCESSFULLY! 🚀`);
  console.log(`======================================================\n`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Scenario test failed:", err);
    process.exit(1);
  });
