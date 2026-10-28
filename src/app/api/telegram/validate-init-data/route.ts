import { NextResponse } from "next/server";
import { validateTelegramInitData } from "@/server/telegram/webapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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
