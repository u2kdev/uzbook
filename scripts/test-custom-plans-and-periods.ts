import { getDb } from "../src/server/db";
import { businesses, subscriptions, users } from "../src/server/db/schema";
import { and, eq } from "drizzle-orm";
import {
  BILLING_PERIODS,
  calculatePlanPrice,
  formatMoney,
  planById,
  type BillingPeriodMonths,
} from "../src/lib/plans";
import { getPendingRequests } from "../src/server/business/admin";
import {
  setBusinessPlanAction,
  updateBusinessCustomPlanConfigAction,
} from "../src/server/actions/admin";
import { createPayment, completePayment } from "../src/server/payments/service";
import { getPublicBusiness, getBusinessBySlug } from "../src/server/business/public";

process.env.PAYMENTS_DEMO = "on";

async function test() {
  console.log("==================================================");
  console.log("  TESTING CUSTOM PLANS, PERIODS & EXPIRATION LOGIC");
  console.log("==================================================");

  const db = await getDb();

  // Find or pick a business
  const [biz] = await db.select().from(businesses).limit(1);
  if (!biz) throw new Error("No business found");

  // 1. Test calculatePlanPrice
  console.log("\n--- 1. Проверка расчёта скидок по периодам (1, 3, 6, 12 мес) ---");
  const p1 = calculatePlanPrice({ baseMonthlyPrice: 100000, months: 1 });
  const p3 = calculatePlanPrice({ baseMonthlyPrice: 100000, months: 3 });
  const p6 = calculatePlanPrice({ baseMonthlyPrice: 100000, months: 6 });
  const p12 = calculatePlanPrice({ baseMonthlyPrice: 100000, months: 12 });

  if (p1.totalAmountUzs !== 100000 || p1.discountPercent !== 0) throw new Error("1 mo discount mismatch");
  if (p3.totalAmountUzs !== 270000 || p3.discountPercent !== 10) throw new Error("3 mo discount mismatch (expected 270k, 10%)");
  if (p6.totalAmountUzs !== 510000 || p6.discountPercent !== 15) throw new Error("6 mo discount mismatch (expected 510k, 15%)");
  if (p12.totalAmountUzs !== 900000 || p12.discountPercent !== 25) throw new Error("12 mo discount mismatch (expected 900k, 25%)");

  console.log("   ✓ 1 мес: 100 000 UZS (0% скидка)");
  console.log("   ✓ 3 мес: 270 000 UZS (10% скидка, 90 000/мес)");
  console.log("   ✓ 6 мес: 510 000 UZS (15% скидка, 85 000/мес)");
  console.log("   ✓ 12 мес: 900 000 UZS (25% скидка, 75 000/мес)");

  // Combined discount: period + custom admin discount
  const pCombined = calculatePlanPrice({
    baseMonthlyPrice: 100000,
    months: 6,
    customDiscountPercent: 10,
  });
  // 15% period + 10% admin = 25% combined
  if (pCombined.discountPercent !== 25 || pCombined.totalAmountUzs !== 450000) {
    throw new Error(`Combined discount mismatch: got ${pCombined.discountPercent}%, ${pCombined.totalAmountUzs}`);
  }
  console.log("   ✓ Суммирование скидки периода (-15%) и админа (-10%): итого -25% (450 000 UZS за 6 мес)");

  // 2. Test getPendingRequests fields (submission date, phone, id, businessId)
  console.log("\n--- 2. Проверка отображения даты отправки, телефона и ID заявки ---");
  // Insert a mock pending subscription
  const [createdPending] = await db
    .insert(subscriptions)
    .values({
      businessId: biz.id,
      plan: "PRO",
      status: "PENDING",
      provider: "MANUAL",
      amount: 270000,
      currency: "UZS",
      note: "Заявка на тариф «PRO» на 3 месяца (скидка 10%)",
      currentPeriodEnd: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    })
    .returning();

  const pendingList = await getPendingRequests();
  const found = pendingList.find((r) => r.subscription.id === createdPending.id);
  if (!found) throw new Error("Pending subscription not returned in getPendingRequests");

  if (!found.subscription.id || !found.businessId || !found.subscription.createdAt) {
    throw new Error("Missing id, businessId, or createdAt in pending request");
  }
  console.log("   ✓ Заявка найдена в списке:");
  console.log(`     - ID заявки: ${found.subscription.id}`);
  console.log(`     - ID бизнеса: ${found.businessId}`);
  console.log(`     - Дата подачи: ${found.subscription.createdAt.toISOString()}`);
  console.log(`     - Контактный телефон: ${found.contactPhone || "не указан"}`);
  console.log(`     - Сумма: ${found.subscription.amount} UZS`);

  // Clean up mock pending
  await db.delete(subscriptions).where(eq(subscriptions.id, createdPending.id));

  // 3. Test multi-month online payment creation and completion
  console.log("\n--- 3. Проверка онлайн-оплаты на 3 месяца (скидка -10%) ---");
  const { payment } = await createPayment({
    business: biz,
    plan: "PRO",
    provider: "DEMO",
    months: 3,
  });

  const payload = payment.payload as Record<string, unknown>;
  if (payload.months !== 3 || payload.discountPercent !== 10) {
    throw new Error(`createPayment payload mismatch: ${JSON.stringify(payload)}`);
  }
  console.log(`   ✓ Платёж создан на 3 месяца с авторасчётом: ${payment.amount} UZS (скидка ${payload.discountPercent}%)`);

  const completion = await completePayment({
    externalId: payment.externalId,
    providerTxnId: `demo-test-${Date.now()}`,
  });
  if (!completion.ok) throw new Error(`completePayment failed: ${completion.error}`);

  const [activeSub] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.businessId, biz.id), eq(subscriptions.status, "ACTIVE")))
    .limit(1);

  if (!activeSub) throw new Error("No active subscription found after payment completion");

  console.log(`   ✓ Подписка успешно активирована до ${completion.periodEnd.toISOString()}`);
  console.log(`   ✓ Примечание: «${activeSub.note}»`);

  // 4. Test custom page suspension on expired trial
  console.log("\n--- 4. Проверка отключения страницы и блокировки API при истечении триала ---");
  // Temporarily set business to expired trial
  await db
    .update(businesses)
    .set({
      plan: "TRIAL",
      trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    })
    .where(eq(businesses.id, biz.id));

  const publicData = await getPublicBusiness(biz.slug);
  if (!publicData || !publicData.isSuspended || publicData.suspensionReason !== "trial_expired") {
    throw new Error(`Public page was not suspended when trial expired: ${JSON.stringify(publicData)}`);
  }
  console.log("   ✓ getPublicBusiness вернул isSuspended: true, suspensionReason: 'trial_expired'");

  // Restore active subscription for business
  await db
    .update(businesses)
    .set({
      plan: "PRO",
      trialEndsAt: null,
    })
    .where(eq(businesses.id, biz.id));

  const restoredPublic = await getPublicBusiness(biz.slug);
  if (!restoredPublic || restoredPublic.isSuspended) {
    throw new Error("Public page still suspended after plan restored");
  }
  console.log("   ✓ После активации тарифа страница онлайн-записи снова доступна");

  console.log("\n==================================================");
  console.log("  ALL CUSTOM PLANS & PERIODS TESTS PASSED! 🚀");
  console.log("==================================================");
}

test()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });
