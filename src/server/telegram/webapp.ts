import crypto from "node:crypto";

export interface TelegramWebUser {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface ValidatedInitData {
  valid: boolean;
  user: TelegramWebUser | null;
  authDate: Date | null;
  queryId: string | null;
  startParam: string | null;
  raw: Record<string, string>;
  error?: string;
}

/**
 * Validates Telegram Mini App `initData` against `TELEGRAM_BOT_TOKEN`.
 * Specification: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * @param initData Raw query string from `Telegram.WebApp.initData`
 * @param token Optional bot token override (defaults to process.env.TELEGRAM_BOT_TOKEN)
 * @param maxAgeSeconds Maximum age of auth_date in seconds (defaults to 86400, 24h)
 */
export function validateTelegramInitData(
  initData: string,
  token?: string,
  maxAgeSeconds = 86400,
): ValidatedInitData {
  const botToken = token || process.env.TELEGRAM_BOT_TOKEN?.trim();

  if (!botToken) {
    return {
      valid: false,
      user: null,
      authDate: null,
      queryId: null,
      startParam: null,
      raw: {},
      error: "bot_token_not_configured",
    };
  }

  if (!initData || typeof initData !== "string") {
    return {
      valid: false,
      user: null,
      authDate: null,
      queryId: null,
      startParam: null,
      raw: {},
      error: "missing_init_data",
    };
  }

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) {
    return {
      valid: false,
      user: null,
      authDate: null,
      queryId: null,
      startParam: null,
      raw: {},
      error: "missing_hash",
    };
  }

  // Remove hash and sort remaining keys alphabetically
  params.delete("hash");
  const raw: Record<string, string> = {};
  const sortedKeys = Array.from(params.keys()).sort();
  const checkPairs: string[] = [];

  for (const key of sortedKeys) {
    const val = params.get(key) ?? "";
    raw[key] = val;
    checkPairs.push(`${key}=${val}`);
  }

  const dataCheckString = checkPairs.join("\n");

  // HMAC-SHA256(key: "WebAppData", data: botToken)
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  // HMAC-SHA256(key: secretKey, data: dataCheckString)
  const calculatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  // Timing safe equal check
  const calculatedBuf = Buffer.from(calculatedHash, "hex");
  const receivedBuf = Buffer.from(hash, "hex");

  if (calculatedBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(calculatedBuf, receivedBuf)) {
    return {
      valid: false,
      user: null,
      authDate: null,
      queryId: null,
      startParam: null,
      raw,
      error: "invalid_signature",
    };
  }

  // Check auth_date expiration
  const authDateTimestamp = Number(raw.auth_date);
  if (!authDateTimestamp || isNaN(authDateTimestamp)) {
    return {
      valid: false,
      user: null,
      authDate: null,
      queryId: null,
      startParam: null,
      raw,
      error: "invalid_auth_date",
    };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (maxAgeSeconds > 0 && Math.abs(nowSeconds - authDateTimestamp) > maxAgeSeconds) {
    return {
      valid: false,
      user: null,
      authDate: new Date(authDateTimestamp * 1000),
      queryId: raw.query_id ?? null,
      startParam: raw.start_param ?? null,
      raw,
      error: "init_data_expired",
    };
  }

  // Parse user object
  let user: TelegramWebUser | null = null;
  if (raw.user) {
    try {
      user = JSON.parse(raw.user);
    } catch {
      user = null;
    }
  }

  return {
    valid: true,
    user,
    authDate: new Date(authDateTimestamp * 1000),
    queryId: raw.query_id ?? null,
    startParam: raw.start_param ?? null,
    raw,
  };
}
