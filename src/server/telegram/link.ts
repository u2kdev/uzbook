import { SignJWT, jwtVerify } from "jose";

/**
 * Short-lived signed token used in the Telegram deep link:
 *   https://t.me/<bot>?start=link_<token>
 *
 * The bot verifies it and binds `users.telegram_id`. We keep this module free of
 * Next.js-only imports so the long-polling bot process can use it too.
 */

const PURPOSE = "telegram-link";
const TTL = "7d";

function secret() {
  const value = process.env.AUTH_SECRET ?? "dev-only-secret-change-me-please-32chars-min";
  return new TextEncoder().encode(value);
}

export type TelegramLinkToken = { userId: string; expiresAt: Date };

export async function createTelegramLinkToken(userId: string): Promise<string> {
  return new SignJWT({ purpose: PURPOSE })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(secret());
}

export async function readTelegramLinkToken(token: string): Promise<TelegramLinkToken | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.purpose !== PURPOSE || !payload.sub) return null;
    return {
      userId: payload.sub,
      expiresAt: new Date((payload.exp ?? 0) * 1000),
    };
  } catch {
    return null;
  }
}

export function botUsername() {
  return (process.env.TELEGRAM_BOT_USERNAME ?? "").replace(/^@/, "").trim();
}
