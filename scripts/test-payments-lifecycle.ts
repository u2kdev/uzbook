import { getDb } from "../src/server/db";
import { businesses, payments, subscriptions, auditLogs, users } from "../src/server/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  createPayment,
  completePayment,
  refundPayment,
  cancelPaymentByAdmin,
  reconcilePaymentSubscription,
} from "../src/server/payments/service";
import { expireUnpaidPayments } from "../src/server/payments/expiry";
import { sanitizePaymentPayload } from "../src/server/payments/security";
import { cryptoDepositConfig, cryptoPaymentsEnabled } from "../src/server/payments/config";

async function run() {
  console.log("==========================================");
  console.log("  TESTING STAGE 4: PAYMENTS BETA LIFECYCLE");
  console.log("==========================================");

  const db = await getDb();
  const [b] = await db.select().from(businesses).limit(1);
  if (!b) throw new Error("No business found");

  const [testUser] = await db.select().from(users).limit(1);
  if (!testUser) throw new Error("No user found");

  // 1. Verify Crypto Config
  console.log("1. Проверка конфигурации криптоплатежей...");
  const isCryptoEnabled = cryptoPaymentsEnabled();
  const depositConfig = cryptoDepositConfig();
  console.log(`   ✓ Crypto enabled: ${isCryptoEnabled}, Asset: ${depositConfig.asset}, Network: ${depositConfig.network}`);
  console.log(`   ✓ Wallet: ${depositConfig.address.slice(0, 8)}..., Rate: ${depositConfig.rateUzs} UZS/USD`);

  // 2. Test Crypto Payment Creation & TXID Confirmation (9.4)
  console.log("2. Тестирование создания платежа и подтверждения по TXID (Crypto)...");
  const { payment: cryptoPayment } = await createPayment({
    business: b,
    provider: "CRYPTO",
    plan: "PRO",
  });
  console.log(`   ✓ Создан платеж CRYPTO: ${cryptoPayment.externalId}, статус: ${cryptoPayment.status}`);

  const testTxHash = `0x_mock_tx_${Date.now()}`;
  const completeResult = await completePayment({
    externalId: cryptoPayment.externalId,
    providerTxnId: testTxHash,
    payload: {
      network: "TRC20",
      amountUsd: 15.48,
      clientNote: "Payment for PRO",
    },
  });

  if (!completeResult.ok) {
    throw new Error(`Ошибка подтверждения крипто-платежа: ${completeResult.error}`);
  }
  console.log(`   ✓ Платеж успешно завершен с TXID ${testTxHash}`);

  // Test duplicate TXID prevention (Idempotency)
  const { payment: duplicatePayment } = await createPayment({
    business: b,
    provider: "CRYPTO",
    plan: "PRO",
  });

  let duplicateFailed = false;
  try {
    const dupRes = await completePayment({
      externalId: duplicatePayment.externalId,
      providerTxnId: testTxHash, // Same TXID!
      payload: {},
    });
    if (!dupRes.ok) duplicateFailed = true;
  } catch {
    duplicateFailed = true;
  }
  if (!duplicateFailed) {
    throw new Error("Duplicate providerTxnId was not blocked!");
  }
  console.log("   ✓ Защита от повторного использования TXID сработала успешно");

  // 3. Test Payment Expiration TTL (9.2)
  console.log("3. Тестирование истечения срока неоплаченных заказов (expireUnpaidPayments)...");
  // Set duplicatePayment's createdAt to 40 minutes ago
  const oldDate = new Date(Date.now() - 40 * 60 * 1000);
  await db
    .update(payments)
    .set({ createdAt: oldDate })
    .where(eq(payments.id, duplicatePayment.id));

  const expiredCount = await expireUnpaidPayments(30);
  console.log(`   ✓ Просроченных платежей переведено в EXPIRED: ${expiredCount}`);

  const [expiredRow] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, duplicatePayment.id));
  if (expiredRow.status !== "EXPIRED") {
    throw new Error(`Expected status EXPIRED, got ${expiredRow.status}`);
  }
  console.log(`   ✓ Статус заказа ${duplicatePayment.externalId} успешно обновлен на EXPIRED`);

  // 4. Test Refund & Audit Log (9.3)
  console.log("4. Тестирование возврата средств (refundPayment) и аудита...");
  // Re-verify that business is PRO before refund
  const [bBefore] = await db.select().from(businesses).where(eq(businesses.id, b.id));
  console.log(`   ✓ Текущий план бизнеса перед рефандом: ${bBefore.plan}`);

  const refundRes = await refundPayment({
    paymentId: cryptoPayment.id,
    refundedByUserId: testUser.id,
    reason: "User requested refund for testing",
  });
  if (!refundRes.ok) {
    throw new Error(`Ошибка возврата средств: ${refundRes.error}`);
  }

  const [bAfter] = await db.select().from(businesses).where(eq(businesses.id, b.id));
  const [refundedPayment] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, cryptoPayment.id));

  if (refundedPayment.status !== "REFUNDED") {
    throw new Error(`Expected payment status REFUNDED, got ${refundedPayment.status}`);
  }
  if (bAfter.plan !== "TRIAL") {
    throw new Error(`Expected business plan to be reset to TRIAL, got ${bAfter.plan}`);
  }
  console.log(`   ✓ Платеж переведен в статус REFUNDED, план сброшен на: ${bAfter.plan}`);

  // Check audit log
  const [latestAudit] = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.entityId, cryptoPayment.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(1);

  if (!latestAudit || latestAudit.action !== "payment.refunded") {
    throw new Error("Audit log for refund was not created!");
  }
  console.log(`   ✓ Запись в audit_logs создана: action=${latestAudit.action}`);

  // 5. Test Admin Cancel (9.3)
  console.log("5. Тестирование ручной отмены администратором (cancelPaymentByAdmin)...");
  const { payment: cancelTestPayment } = await createPayment({
    business: b,
    provider: "DEMO",
    plan: "START",
  });
  const cancelRes = await cancelPaymentByAdmin({
    paymentId: cancelTestPayment.id,
    adminUserId: testUser.id,
    reason: "Abusive or duplicate order",
  });
  if (!cancelRes.ok) {
    throw new Error(`Ошибка отмены: ${cancelRes.error}`);
  }
  const [cancelledRow] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, cancelTestPayment.id));
  if (cancelledRow.status !== "CANCELLED") {
    throw new Error(`Expected status CANCELLED, got ${cancelledRow.status}`);
  }
  console.log(`   ✓ Платеж ${cancelTestPayment.externalId} отменен администратором`);

  // 6. Test Reconcile Subscription (9.3)
  console.log("6. Тестирование сверки подписки (reconcilePaymentSubscription)...");
  const reconcileRes = await reconcilePaymentSubscription(b.id);
  console.log(`   ✓ Сверка выполнена: activePlan=${reconcileRes.activePlan}, synced=${reconcileRes.synced}, msg=${reconcileRes.message}`);

  // 7. Test Payload Sanitizer (9.1 & 9.4)
  console.log("7. Проверка очистки конфиденциальных данных (sanitizePaymentPayload)...");
  const dirtyPayload = {
    sign_string: "super_secret_md5_hash",
    password: "bank_password_123",
    secretKey: "payme_sec_abc",
    click_trans_id: 1234567,
    amount: 199000,
  };
  const sanitized = sanitizePaymentPayload(dirtyPayload) as Record<string, unknown>;
  if (
    sanitized.sign_string !== "[REDACTED]" ||
    sanitized.password !== "[REDACTED]" ||
    sanitized.secretKey !== "[REDACTED]" ||
    sanitized.click_trans_id !== 1234567
  ) {
    throw new Error(`Sanitizer failed to mask secrets properly: ${JSON.stringify(sanitized)}`);
  }
  console.log("   ✓ Чувствительные поля (sign_string, password, secretKey) замаскированы [REDACTED]");

  console.log("==========================================");
  console.log("  STAGE 4 PAYMENTS TESTS PASSED! 🚀");
  console.log("==========================================");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });
