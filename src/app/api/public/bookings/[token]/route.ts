import { NextResponse } from "next/server";
import { cancelBooking, getBookingByToken } from "@/server/booking/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const booking = await getBookingByToken(token);
  if (!booking) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({
    booking: {
      id: booking.id,
      startAt: booking.startAt.toISOString(),
      endAt: booking.endAt.toISOString(),
      status: booking.status,
      clientName: booking.clientName,
      service: { id: booking.service.id, name: booking.service.name },
      staff: { id: booking.staff.id, name: booking.staff.name },
      business: { name: booking.business.name, slug: booking.business.slug },
    },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const result = await cancelBooking(token);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
