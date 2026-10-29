import { logger } from "@/server/logger";

const sensitiveKeys = new Set([
  "password",
  "key",
  "secret",
  "secretkey",
  "secret_key",
  "token",
  "authorization",
  "sign_string",
  "card",
  "card_number",
  "cvv",
]);

/**
 * Strips secrets, keys, and authorization tokens before writing webhook payloads to logs.
 */
export function sanitizePaymentPayload(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizePaymentPayload);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.has(lowerKey)) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof val === "object" && val !== null) {
      sanitized[key] = sanitizePaymentPayload(val);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized;
}

// Failure tracker for alerting on mass payment failures or brute force attempts
const failureCounts = new Map<string, { count: number; firstAt: number }>();
const FAILURE_THRESHOLD = 10;
const FAILURE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
let lastFailureSweep = 0;

export function trackWebhookFailure(provider: string, reason: string, ip?: string): void {
  const now = Date.now();
  if (now - lastFailureSweep > 60_000) {
    for (const [k, entry] of failureCounts) {
      if (now - entry.firstAt > FAILURE_WINDOW_MS) {
        failureCounts.delete(k);
      }
    }
    lastFailureSweep = now;
  }

  const key = `${provider}:${ip || "global"}`;
  const current = failureCounts.get(key);

  if (!current || now - current.firstAt > FAILURE_WINDOW_MS) {
    failureCounts.set(key, { count: 1, firstAt: now });
  } else {
    current.count += 1;
    if (current.count >= FAILURE_THRESHOLD) {
      logger.error("payment.webhook_spike_alert", new Error(`High failure rate on ${provider} webhook`), {
        provider,
        reason,
        ip,
        failuresCount: current.count,
        windowMinutes: 5,
      });
    }
  }
}
