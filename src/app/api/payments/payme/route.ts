import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/server/db";
import { payments } from "@/server/db/schema";
import { planById } from "@/lib/plans";
import { clientIp, isIpAllowed, rateLimit } from "@/server/http/rate-limit";
import { paymeConfig } from "@/server/payments/config";
import {
  cancelPayment,
  completePayment,
  getPaymentByExternalId,
  markPaymentPending,
} from "@/server/payments/service";
import { sanitizePaymentPayload, trackWebhookFailure } from "@/server/payments/security";
import { logger } from "@/server/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonRpcId = string | number | null;

type PaymeParams = {
  id?: string;
  time?: number;
  amount?: number;
  reason?: number;
  from?: number;
  to?: number;
  account?: { order_id?: string };
};

const ERRORS = {
  auth: { code: -32504, message: "Недостаточно привилегий" },
  parse: { code: -32700, message: "Ошибка разбора JSON" },
  request: { code: -32600, message: "Неверный запрос" },
  method: { code: -32300, message: "Метод не поддерживается" },
  order: { code: -31001, message: "Заказ не найден" },
  amount: { code: -31008, message: "Неверная сумма" },
  state: { code: -31007, message: "Невозможно выполнить операцию" },
  transaction: { code: -31003, message: "Транзакция не найдена" },
} as const;

function answer(id: JsonRpcId, result: Record<string, unknown>) {
  return Response.json({ jsonrpc: "2.0", id, result });
}

function fail(id: JsonRpcId, error: { code: number; message: string }) {
  return Response.json({ jsonrpc: "2.0", id, error });
}

function authorized(request: Request): boolean {
  const { key } = paymeConfig();
  if (!key) return false;
  const header = request.headers.get("authorization") ?? "";
  const encoded = header.replace(/^Basic\s+/i, "").trim();
  return encoded === Buffer.from(`Paycom:${key}`).toString("base64");
}

function transactionState(payment: {
  status: string;
  paidAt: Date | null;
}): number {
  if (payment.status === "PAID") return 2;
  if (payment.status === "CANCELLED") return payment.paidAt ? -2 : -1;
  if (payment.status === "FAILED") return -1;
  return 1;
}

function createTimeOf(payment: {
  createdAt: Date;
  payload: Record<string, unknown> | null;
}): number {
  const stored = Number(payment.payload?.payme_time);
  return Number.isFinite(stored) && stored > 0 ? stored : payment.createdAt.getTime();
}

async function findByTransaction(transactionId: string) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.providerTxnId, transactionId),
        eq(payments.provider, "PAYME"),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function findByOrder(orderId: string) {
  const row = await getPaymentByExternalId(orderId);
  if (!row || row.payment.provider !== "PAYME") return null;
  return row;
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!isIpAllowed(ip, process.env.PAYME_IP_ALLOWLIST)) {
    trackWebhookFailure("payme", "ip_not_allowed", ip);
    return fail(null, ERRORS.auth);
  }

  if (!authorized(request)) {
    trackWebhookFailure("payme", "unauthorized", ip);
    return fail(null, ERRORS.auth);
  }

  const limit = rateLimit(`payme:${ip}`, 120, 60_000);
  if (!limit.ok) {
    trackWebhookFailure("payme", "rate_limit_exceeded", ip);
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code: -32504, message: "Too many requests" } },
      {
        status: 429,
        headers: {
          "retry-after": String(Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))),
        },
      },
    );
  }

  let body: { id?: JsonRpcId; method?: string; params?: PaymeParams };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    trackWebhookFailure("payme", "json_parse_error", ip);
    return fail(null, ERRORS.parse);
  }

  const id = body.id ?? null;
  const method = body.method ?? "";
  const params = body.params ?? {};

  logger.info("payme.webhook_request", {
    method,
    params: sanitizePaymentPayload(params),
  });

  if (method === "CheckPerformTransaction") {
    const orderId = params.account?.order_id ?? "";
    const row = await findByOrder(orderId);
    if (!row) return fail(id, ERRORS.order);
    if (row.payment.status === "PAID") return fail(id, ERRORS.state);

    const expected = planById(row.payment.plan).priceUzs * 100;
    if (Number(params.amount) !== expected) return fail(id, ERRORS.amount);
    return answer(id, { allow: true });
  }

  if (method === "CreateTransaction") {
    const transactionId = params.id ?? "";
    if (!transactionId) return fail(id, ERRORS.request);

    const existing = await findByTransaction(transactionId);
    if (existing) {
      if (existing.status === "CANCELLED") return fail(id, ERRORS.state);
      return answer(id, {
        create_time: createTimeOf(existing),
        transaction: existing.providerTxnId,
        state: transactionState(existing),
      });
    }

    const orderId = params.account?.order_id ?? "";
    const row = await findByOrder(orderId);
    if (!row) return fail(id, ERRORS.order);
    if (row.payment.status === "PAID") return fail(id, ERRORS.state);
    if (row.payment.status === "CANCELLED" || row.payment.status === "FAILED") {
      return fail(id, ERRORS.state);
    }

    const expected = planById(row.payment.plan).priceUzs * 100;
    if (Number(params.amount) !== expected) return fail(id, ERRORS.amount);

    const createTime = Number(params.time) || Date.now();
    const updated = await markPaymentPending({
      externalId: orderId,
      providerTxnId: transactionId,
      payload: { payme_time: createTime },
    });
    if (!updated) return fail(id, ERRORS.state);

    return answer(id, {
      create_time: createTime,
      transaction: transactionId,
      state: 1,
    });
  }

  if (method === "PerformTransaction") {
    const transactionId = params.id ?? "";
    const existing = await findByTransaction(transactionId);
    if (!existing) return fail(id, ERRORS.transaction);

    if (existing.status === "PAID") {
      return answer(id, {
        transaction: transactionId,
        perform_time: existing.paidAt?.getTime() ?? Date.now(),
        state: 2,
      });
    }
    if (existing.status === "CANCELLED" || existing.status === "FAILED") {
      return fail(id, ERRORS.state);
    }

    const result = await completePayment({
      externalId: existing.externalId,
      providerTxnId: transactionId,
      payload: { payme_perform_time: Date.now() },
    });
    if (!result.ok) return fail(id, ERRORS.state);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/billing");
    revalidatePath("/admin");

    return answer(id, {
      transaction: transactionId,
      perform_time: result.payment.paidAt?.getTime() ?? Date.now(),
      state: 2,
    });
  }

  if (method === "CancelTransaction") {
    const transactionId = params.id ?? "";
    const existing = await findByTransaction(transactionId);
    if (!existing) return fail(id, ERRORS.transaction);

    const wasPaid = existing.status === "PAID";
    const cancelTime = Date.now();
    if (!(existing.status === "CANCELLED")) {
      await cancelPayment({
        providerTxnId: transactionId,
        reason: `payme_cancel_${params.reason ?? 0}`,
        payload: {
          payme_cancel_time: cancelTime,
          payme_reason: params.reason ?? 0,
        },
      });
    }

    return answer(id, {
      transaction: transactionId,
      cancel_time: cancelTime,
      state: wasPaid ? -2 : -1,
    });
  }

  if (method === "CheckTransaction") {
    const transactionId = params.id ?? "";
    const existing = await findByTransaction(transactionId);
    if (!existing) return fail(id, ERRORS.transaction);

    const payload = (existing.payload ?? {}) as Record<string, unknown>;
    return answer(id, {
      create_time: createTimeOf(existing),
      perform_time: existing.paidAt?.getTime() ?? 0,
      cancel_time: Number(payload.payme_cancel_time ?? 0),
      transaction: transactionId,
      state: transactionState(existing),
      reason: existing.status === "CANCELLED" ? payload.payme_reason ?? 0 : null,
    });
  }

  if (method === "GetStatement") {
    const from = Number(params.from) || 0;
    const to = Number(params.to) || Date.now();
    const db = await getDb();
    const rows = await db
      .select()
      .from(payments)
      .where(and(eq(payments.provider, "PAYME"), eq(payments.status, "PAID")));

    return answer(
      id,
      {
        transactions: rows
          .filter((row) => {
            const time = row.paidAt?.getTime() ?? row.createdAt.getTime();
            return time >= from && time <= to;
          })
          .map((row) => ({
            id: row.providerTxnId,
            time: row.createdAt.getTime(),
            amount: row.amount * 100,
            account: { order_id: row.externalId },
            create_time: createTimeOf(row),
            perform_time: row.paidAt?.getTime() ?? 0,
            cancel_time: 0,
            transaction: row.providerTxnId,
            state: 2,
            reason: null,
          })),
      },
    );
  }

  return fail(id, ERRORS.method);
}
