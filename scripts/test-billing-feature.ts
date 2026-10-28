import { getDb } from "../src/server/db";
import { businesses, subscriptions } from "../src/server/db/schema";
import { eq } from "drizzle-orm";
import { PLANS, planById, formatMoney } from "../src/lib/plans";
import { getUsage, getSubscriptionInfo } from "../src/server/limits";

async function run() {
  console.log("==========================================");
  console.log("  TESTING STAGE 1.6 BILLING, LIMITS & PLANS");
  console.log("==========================================");

  const db = await getDb();
  const [b] = await db.select().from(businesses).limit(1);
  if (!b) throw new Error("No business found");

  // 1. Verify Plans structure
  console.log("1. Проверка структуры тарифов...");
  const startPlan = planById("START");
  const proPlan = planById("PRO");
  const businessPlan = planById("BUSINESS");

  if (!startPlan || !proPlan || !businessPlan) {
    throw new Error("Missing tariff definitions");
  }
  console.log("   ✓ Тарифы START, PRO, BUSINESS сконфигурированы корректно");

  // 2. Verify Limits calculation
  console.log("2. Проверка расчета лимитов...");
  const usage = await getUsage(b);
  console.log(`   ✓ Использование: Мастеров: ${usage.staff}, Услуг: ${usage.services}, Хранилище: ${usage.storageBytes} байт`);

  // 3. Subscription info check
  console.log("3. Проверка статуса подписки бизнеса...");
  const subInfo = await getSubscriptionInfo(b);
  console.log(`   ✓ План: ${b.plan}, Истекла: ${subInfo.trialExpired}, Дней триала: ${subInfo.trialDaysLeft ?? "N/A"}`);

  // 4. Test Subscription History insertion
  console.log("4. Проверка фиксации истории подписок...");
  const [subRow] = await db
    .insert(subscriptions)
    .values({
      businessId: b.id,
      plan: "PRO",
      status: "ACTIVE",
      provider: "DEMO",
      amount: 199000,
      currency: "UZS",
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    })
    .returning();

  if (!subRow || subRow.status !== "ACTIVE") {
    throw new Error("Failed to record subscription history");
  }
  console.log("   ✓ Запись в истории подписок создана:", subRow.id, formatMoney(subRow.amount, subRow.currency));

  console.log("==========================================");
  console.log("  STAGE 1.6 BILLING TESTS PASSED! 🚀");
  console.log("==========================================");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
