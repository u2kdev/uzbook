import crypto from "node:crypto";
import { webhookCallback } from "grammy";
import { NextResponse } from "next/server";
import { initBotInstance } from "@/server/telegram/bot-instance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let cachedHandler: ((req: Request) => Promise<Response>) | null = null;

function getHandler() {
  if (!cachedHandler) {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!token) return null;
    const bot = initBotInstance(token);
    cachedHandler = webhookCallback(bot, "std/http", {
      timeoutMilliseconds: 25_000,
    });
  }
  return cachedHandler;
}

export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (secret) {
    const headerSecret = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
    const expectedBuf = Buffer.from(secret);
    const receivedBuf = Buffer.from(headerSecret);

    if (
      expectedBuf.length !== receivedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, receivedBuf)
    ) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const handler = getHandler();
  if (!handler) {
    return NextResponse.json(
      { error: "TELEGRAM_BOT_TOKEN not configured" },
      { status: 503 },
    );
  }

  return handler(request);
}

export async function GET() {
  const token = Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
  const secret = Boolean(process.env.TELEGRAM_WEBHOOK_SECRET?.trim());

  return NextResponse.json({
    ok: true,
    service: "telegram-webhook",
    configured: token,
    secretProtected: secret,
  });
}
