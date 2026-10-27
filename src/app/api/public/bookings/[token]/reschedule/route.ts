import { NextResponse } from "next/server";
import { rescheduleBooking } from "@/server/booking/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  let startAt = "";
  try {
    const body = (await request.json()) as { startAt?: string };
    startAt = body.startAt ?? "";
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const result = await rescheduleBooking(token, startAt);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    startAt: result.data.startAt.toISOString(),
    endAt: result.data.endAt.toISOString(),
  });
}
