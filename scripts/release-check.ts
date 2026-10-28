import { getDb } from "../src/server/db";
import { sql } from "drizzle-orm";
import { users, businesses, staff, services, payments, subscriptions, auditLogs } from "../src/server/db/schema";
import { authSecret } from "../src/server/config/env";
import { demoPaymentsEnabled, paymeConfig, clickConfig, telegramPaymentsEnabled } from "../src/server/payments/config";

async function run() {
  console.log("==========================================");
  console.log("  UZBOOK PRE-RELEASE GATES AUDIT CHECK");
  console.log("==========================================");

  let passed = true;
  const warnings: string[] = [];

  // 1. Database Connectivity & Readiness
  console.log("1. Проверка подключения к базе данных...");
  const start = performance.now();
  const db = await getDb();
  await db.execute(sql`select 1`);
  const latency = Math.round(performance.now() - start);
  console.log(`   ✓ База данных доступна (задержка: ${latency} мс)`);

  // 2. Schema & Tables Integrity
  console.log("2. Проверка структуры таблиц...");
  const [userCount] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  const [bizCount] = await db.select({ count: sql<number>`count(*)::int` }).from(businesses);
  const [staffCount] = await db.select({ count: sql<number>`count(*)::int` }).from(staff);
  const [serviceCount] = await db.select({ count: sql<number>`count(*)::int` }).from(services);
  const [paymentCount] = await db.select({ count: sql<number>`count(*)::int` }).from(payments);
  const [subCount] = await db.select({ count: sql<number>`count(*)::int` }).from(subscriptions);
  const [auditCount] = await db.select({ count: sql<number>`count(*)::int` }).from(auditLogs);

  console.log(`   ✓ Таблицы валидны: Users(${userCount.count}), Businesses(${bizCount.count}), Staff(${staffCount.count}), Services(${serviceCount.count}), Payments(${paymentCount.count}), Subscriptions(${subCount.count}), AuditLogs(${auditCount.count})`);

  // 3. Admin Account Verification
  console.log("3. Проверка наличия администратора системы...");
  const [admin] = await db
    .select()
    .from(users)
    .where(sql`role IN ('ADMIN', 'SUPPORT')`)
    .limit(1);

  if (!admin) {
    console.log("   ❌ Нет пользователей с ролью ADMIN или SUPPORT! Создайте через scripts/create-admin.ts");
    passed = false;
  } else {
    console.log(`   ✓ Администратор найден: ${admin.email} (${admin.role})`);
  }

  // 4. Secrets & Cryptographic Keys
  console.log("4. Проверка криптографических секретов...");
  const secret = authSecret();
  if (!secret || secret.length < 32) {
    console.log("   ❌ AUTH_SECRET слишком короткий или не задан (требуется >= 32 символов)!");
    passed = false;
  } else {
    console.log("   ✓ AUTH_SECRET сконфигурирован надежно");
  }

  // 5. Payments Configuration & Release Mode
  console.log("5. Проверка платёжных шлюзов...");
  const isDemo = demoPaymentsEnabled();
  if (isDemo && process.env.NODE_ENV === "production") {
    warnings.push("Внимание: PAYMENTS_DEMO включен в production-окружении!");
  }
  const payme = paymeConfig();
  const click = clickConfig();
  const tg = telegramPaymentsEnabled();

  console.log(`   ✓ Payme enabled: ${payme.enabled}`);
  console.log(`   ✓ Click enabled: ${click.enabled}`);
  console.log(`   ✓ Telegram Stars enabled: ${tg}`);
  console.log(`   ✓ Demo Payments enabled: ${isDemo}`);

  // Summary
  console.log("==========================================");
  if (warnings.length > 0) {
    console.log("ПРЕДУПРЕЖДЕНИЯ:");
    for (const w of warnings) {
      console.log(`  ⚠️  ${w}`);
    }
  }

  if (passed) {
    console.log("  ВСЕ ПРЕДРЕЛИЗНЫЕ ПРОВЕРКИ ПРОЙДЕНЫ! 🚀");
    console.log("==========================================");
    process.exit(0);
  } else {
    console.error("  ПРОВЕРКА НЕ ПРОЙДЕНА: ОБНАРУЖЕНЫ ОШИБКИ");
    console.log("==========================================");
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Release check crashed:", err);
  process.exit(1);
});
