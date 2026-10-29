import { createHash, timingSafeEqual } from "node:crypto";
import { clientIp, isIpAllowed, rateLimit } from "@/server/http/rate-limit";
import { clickConfig } from "@/server/payments/config";
import {
  completePayment,
  failPayment,
  getPaymentByExternalId,
  markPaymentPending,
} from "@/server/payments/service";
import { sanitizePaymentPayload, trackWebhookFailure } from "@/server/payments/security";
import { logger } from "@/server/logger";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ClickResponse = {
  error: number;
  error_note: string;
  click_trans_id?: number | string;
  merchant_trans_id?: string;
  merchant_prepare_id?: string;
  merchant_confirm_id?: string;
};

function reply(body: ClickResponse) {
  return Response.json(body);
}

function sign(params: {
  clickTransId: string;
  serviceId: string;
  secretKey: string;
  merchantTransId: string;
  amount: string;
  action: string;
  signTime: string;
}) {
  return createHash("md5")
    .update(
      [
        params.clickTransId,
        params.serviceId,
        params.secretKey,
        params.merchantTransId,
        params.amount,
        params.action,
        params.signTime,
      ].join(""),
    )
    .digest("hex");
}

export async function POST(request: Request) {
  const config = clickConfig();
  if (!config.enabled) {
    return reply({ error: -1, error_note: "Click не настроен" });
  }

  const ip = clientIp(request);
  if (!isIpAllowed(ip, process.env.CLICK_IP_ALLOWLIST)) {
    trackWebhookFailure("click", "ip_not_allowed", ip);
    return Response.json({ error: -1, error_note: "IP not allowed" }, { status: 403 });
  }

  const limit = rateLimit(`click:${ip}`, 120, 60_000);
  if (!limit.ok) {
    trackWebhookFailure("click", "rate_limit_exceeded", ip);
    return Response.json(
      { error: -1, error_note: "Too many requests" },
      {
        status: 429,
        headers: {
          "retry-after": String(Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))),
        },
      },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    trackWebhookFailure("click", "form_parse_error", ip);
    return reply({ error: -8, error_note: "Bad request" });
  }

  const clickTransId = String(form.get("click_trans_id") ?? "");
  const serviceId = String(form.get("service_id") ?? "");
  const merchantTransId = String(form.get("merchant_trans_id") ?? "");
  const amount = String(form.get("amount") ?? "");
  const action = String(form.get("action") ?? "");
  const signTime = String(form.get("sign_time") ?? "");
  const signString = String(form.get("sign_string") ?? "");
  const error = Number(form.get("error") ?? 0);
  const merchantPrepareId = String(form.get("merchant_prepare_id") ?? "");
  const clickPaydocId = String(form.get("click_paydoc_id") ?? "");

  const formEntries: Record<string, unknown> = {};
  for (const [key, val] of form.entries()) {
    formEntries[key] = val;
  }
  logger.info("click.webhook_request", {
    action,
    payload: sanitizePaymentPayload(formEntries),
  });

  if (
    !clickTransId ||
    !merchantTransId ||
    !amount ||
    !action ||
    !signTime ||
    !signString
  ) {
    trackWebhookFailure("click", "missing_parameters", ip);
    return reply({ error: -2, error_note: "Missing parameters" });
  }

  if (serviceId !== config.serviceId) {
    trackWebhookFailure("click", "unknown_service", ip);
    return reply({ error: -2, error_note: "Unknown service" });
  }

  const expectedSign = sign({
    clickTransId,
    serviceId,
    secretKey: config.secretKey,
    merchantTransId,
    amount,
    action,
    signTime,
  }).toLowerCase();
  const receivedSign = signString.trim().toLowerCase();
  const expectedBuf = Buffer.from(expectedSign);
  const receivedBuf = Buffer.from(receivedSign);
  if (
    expectedBuf.length !== receivedBuf.length ||
    !timingSafeEqual(expectedBuf, receivedBuf)
  ) {
    trackWebhookFailure("click", "invalid_signature", ip);
    return reply({ error: -1, error_note: "Invalid sign" });
  }

  const row = await getPaymentByExternalId(merchantTransId);
  if (!row || row.payment.provider !== "CLICK") {
    return reply({ error: -5, error_note: "Order not found" });
  }

  const payment = row.payment;
  const expectedAmount = payment.amount;

  if (action === "0") {
    if (payment.status === "PAID") {
      return reply({ error: -4, error_note: "Already paid" });
    }
    if (payment.status === "CANCELLED" || payment.status === "FAILED") {
      return reply({ error: -5, error_note: "Order cancelled" });
    }
    if (Math.abs(Number(amount) - expectedAmount) > 0.01) {
      return reply({ error: -6, error_note: "Incorrect amount" });
    }

    const updated = await markPaymentPending({
      externalId: merchantTransId,
      providerTxnId: clickTransId,
      payload: {
        click_trans_id: clickTransId,
        click_paydoc_id: clickPaydocId,
        click_prepare_time: Date.now(),
      },
    });
    if (!updated) {
      return reply({ error: -5, error_note: "Order not found" });
    }

    return reply({
      error: 0,
      error_note: "Success",
      click_trans_id: clickTransId,
      merchant_trans_id: merchantTransId,
      merchant_prepare_id: payment.id,
    });
  }

  if (action === "1") {
    if (error !== 0) {
      if (payment.status === "PAID") {
        return reply({ error: -4, error_note: "Already paid" });
      }
      await failPayment(merchantTransId);
      return reply({
        error: 0,
        error_note: "Cancelled",
        click_trans_id: clickTransId,
        merchant_trans_id: merchantTransId,
      });
    }

    if (payment.status === "PAID") {
      return reply({
        error: 0,
        error_note: "Already paid",
        click_trans_id: clickTransId,
        merchant_trans_id: merchantTransId,
        merchant_confirm_id: payment.id,
      });
    }

    if (payment.status === "CANCELLED" || payment.status === "FAILED") {
      return reply({ error: -9, error_note: "Transaction cancelled" });
    }

    if (merchantPrepareId && merchantPrepareId !== payment.id) {
      return reply({ error: -7, error_note: "Transaction not found" });
    }

    if (Math.abs(Number(amount) - expectedAmount) > 0.01) {
      return reply({ error: -6, error_note: "Incorrect amount" });
    }

    const result = await completePayment({
      externalId: merchantTransId,
      providerTxnId: clickTransId,
      payload: {
        click_trans_id: clickTransId,
        click_paydoc_id: clickPaydocId,
        click_complete_time: Date.now(),
      },
    });

    if (!result.ok) {
      return reply({ error: -9, error_note: result.error });
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/billing");
    revalidatePath("/admin");

    return reply({
      error: 0,
      error_note: "Success",
      click_trans_id: clickTransId,
      merchant_trans_id: merchantTransId,
      merchant_confirm_id: payment.id,
    });
  }

  return reply({ error: -3, error_note: "Unknown action" });
}
