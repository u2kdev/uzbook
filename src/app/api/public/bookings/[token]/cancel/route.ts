import { NextResponse } from "next/server";
import { cancelBooking } from "@/server/booking/service";
import { clientIp, rateLimit } from "@/server/http/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const ip = clientIp(request);
  if (!rateLimit(`pub_booking_cancel:${ip}`, 20, 60_000).ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const { token } = await params;
  let reason: string | undefined;
  try {
    const body = (await request.json()) as { reason?: string };
    reason = body.reason;
  } catch {
    /* empty body is fine */
  }

  const result = await cancelBooking(token, reason);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
