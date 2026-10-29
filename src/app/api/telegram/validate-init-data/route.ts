import { NextResponse } from "next/server";
import { validateTelegramInitData } from "@/server/telegram/webapp";
import { clientIp, rateLimit } from "@/server/http/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!rateLimit(`tg_validate_init:${ip}`, 30, 60_000).ok) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }
  try {
    const { initData } = await request.json();
    const result = validateTelegramInitData(initData);
    if (!result.valid) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 401 });
    }
    return NextResponse.json({
      ok: true,
      user: result.user,
      startParam: result.startParam,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }
}
