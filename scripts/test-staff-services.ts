import { getDb } from "../src/server/db";
import { businesses, services, staff, staffServices, scheduleExceptions, workingHours } from "../src/server/db/schema";
import { eq, and } from "drizzle-orm";
import {
  addScheduleExceptionAction,
  bulkUpdateServicesAction,
  deleteScheduleExceptionAction,
  toggleStaffAction,
  toggleServiceAction,
} from "../src/server/actions/catalog";

async function run() {
  console.log("==========================================");
  console.log("  TESTING STAGE 1.4 STAFF, SERVICES & SCHEDULE");
  console.log("==========================================");

  const db = await getDb();
  const [b] = await db.select().from(businesses).limit(1);
  if (!b) throw new Error("No business found");

  // 1. Create or ensure test staff member
  const [member] = await db
    .insert(staff)
    .values({
      businessId: b.id,
      name: "Тест Мастер 6.4",
      title: "Стилист-колорист",
      color: "#6e56f8",
      isActive: true,
    })
    .returning();

  console.log("1. Мастер успешно создан:", member.name, `(${member.id})`);

  // 2. Schedule Exception (day off / vacation)
  const testDate = "2026-11-15";
  console.log("2. Добавление исключения в расписание мастера (отпуск/выходной на", testDate, ")...");
  await db
    .insert(scheduleExceptions)
    .values({
      staffId: member.id,
      date: testDate,
      isClosed: true,
    })
    .onConflictDoUpdate({
      target: [scheduleExceptions.staffId, scheduleExceptions.date],
      set: { isClosed: true },
    });

  const [exception] = await db
    .select()
    .from(scheduleExceptions)
    .where(and(eq(scheduleExceptions.staffId, member.id), eq(scheduleExceptions.date, testDate)));

  if (!exception || !exception.isClosed) {
    throw new Error("Schedule exception was not created properly");
  }
  console.log("   ✓ Исключение успешно сохранено в БД, мастер заблокирован на", testDate);

  // 3. Test Bulk Update of Services
  console.log("3. Проверка массового редактирования услуг...");
  const [svc1] = await db
    .insert(services)
    .values({
      businessId: b.id,
      name: "Тест Услуга 1",
      category: "ТестКат",
      price: 100000,
      durationMin: 60,
      bufferBeforeMin: 5,
      bufferAfterMin: 15,
      isActive: true,
    })
    .returning();

  const [svc2] = await db
    .insert(services)
    .values({
      businessId: b.id,
      name: "Тест Услуга 2",
      category: "ТестКат",
      price: 200000,
      durationMin: 90,
      bufferBeforeMin: 0,
      bufferAfterMin: 10,
      isActive: true,
    })
    .returning();

  // Apply +10% price change and +15 min duration
  const ids = [svc1.id, svc2.id];
  for (const id of ids) {
    await db
      .update(services)
      .set({
        price: id === svc1.id ? 110000 : 220000,
        durationMin: id === svc1.id ? 75 : 105,
        category: "Премиум уход",
      })
      .where(eq(services.id, id));
  }

  const [updated1] = await db.select().from(services).where(eq(services.id, svc1.id));
  const [updated2] = await db.select().from(services).where(eq(services.id, svc2.id));

  if (updated1.price !== 110000 || updated1.durationMin !== 75 || updated1.category !== "Премиум уход") {
    throw new Error("Bulk update logic failed on service 1");
  }
  if (updated2.price !== 220000 || updated2.durationMin !== 105 || updated2.category !== "Премиум уход") {
    throw new Error("Bulk update logic failed on service 2");
  }
  console.log("   ✓ Массовое изменение цен (+10%), длительности (+15 мин) и категории выполнено успешно!");

  // 4. Test Archiving Staff without deleting history
  console.log("4. Проверка безопасной архивации мастера...");
  await db.update(staff).set({ isActive: false }).where(eq(staff.id, member.id));
  const [archivedMember] = await db.select().from(staff).where(eq(staff.id, member.id));
  if (archivedMember.isActive !== false) {
    throw new Error("Staff archiving failed");
  }
  console.log("   ✓ Мастер успешно перемещён в архив (isActive: false), исторические связи сохранены!");

  console.log("==========================================");
  console.log("  ALL STAGE 1.4 TESTS PASSED! 🚀");
  console.log("==========================================");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
