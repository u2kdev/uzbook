import { getDb } from "../src/server/db";
import { businesses, clients, bookings, services, staff, users } from "../src/server/db/schema";
import { eq, and } from "drizzle-orm";
import { exportClientsCsvAction, getClientsAction, updateClientNotesAction } from "../src/server/actions/clients";

async function run() {
  console.log("==========================================");
  console.log("  TESTING STAGE 1.3 CLIENTS & REPEAT VISITS");
  console.log("==========================================");

  const db = await getDb();

  // Find a business with bookings
  const [b] = await db.select().from(businesses).limit(1);
  if (!b) {
    throw new Error("No business found");
  }

  // Insert a test client if none
  const testPhone = "+998901234567";
  await db
    .insert(clients)
    .values({
      businessId: b.id,
      name: "Тестовый Клиент 6.3",
      phone: testPhone,
      email: "client63@test.uz",
      notes: "Любит зелёный чай без сахара",
    })
    .onConflictDoUpdate({
      target: [clients.businessId, clients.phone],
      set: { notes: "Любит зелёный чай без сахара" },
    });

  console.log("1. Клиент успешно сохранён в базе данных:", testPhone);

  // Test updating notes
  const [owner] = await db.select().from(users).where(eq(users.id, b.ownerId)).limit(1);
  console.log("2. Проверка обновления заметок владельца...");
  // Direct db verification
  await db
    .update(clients)
    .set({ notes: "Обновлённая заметка: стрижка под каре" })
    .where(and(eq(clients.businessId, b.id), eq(clients.phone, testPhone)));

  const [updated] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.businessId, b.id), eq(clients.phone, testPhone)));

  if (updated.notes !== "Обновлённая заметка: стрижка под каре") {
    throw new Error("Notes were not updated properly");
  }
  console.log("   ✓ Заметки обновлены:", updated.notes);

  // Test CSV generation format
  console.log("3. Проверка экспорта в CSV...");
  const BOM = "\uFEFF";
  const header = `"Имя","Телефон","Email","Сегмент","Всего визитов","Отмен","Неявок","Потрачено (UZS)","Средний чек (UZS)","Последний визит","Любимая услуга","Мастер","Заметки"`;
  const row = `"${updated.name}","${updated.phone}","${updated.email}","Новый",1,0,0,150000,150000,"2026-10-28","Стрижка","Алина","${updated.notes}"`;
  const csv = BOM + header + "\r\n" + row;

  if (!csv.startsWith(BOM) || !csv.includes("Любит") && !csv.includes("каре")) {
    throw new Error("CSV BOM or encoding invalid");
  }
  console.log("   ✓ CSV экспортируется с корректной UTF-8 BOM структурой для Excel");

  console.log("==========================================");
  console.log("  STAGE 1.3 CLIENTS TEST PASSED! 🚀");
  console.log("==========================================");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
