import { NextResponse } from "next/server";
import { z } from "zod";
import { getBusinessBySlug } from "@/server/business/public";
import { createBooking } from "@/server/booking/service";
import { getSession } from "@/server/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  staffId: z.string().min(1),
  serviceId: z.string().min(1),
  startAt: z.string().min(10),
  name: z.string().min(2).max(120),
  phone: z.string().min(7).max(30),
  email: z.string().max(120).optional().or(z.literal("")),
  note: z.string().max(500).optional().or(z.literal("")),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business || business.status !== "ACTIVE") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const session = await getSession();
  const result = await createBooking({
    business,
    staffId: parsed.data.staffId,
    serviceId: parsed.data.serviceId,
    startAt: parsed.data.startAt,
    name: parsed.data.name,
    phone: parsed.data.phone,
    email: parsed.data.email || null,
    note: parsed.data.note || null,
    source: session ? "MANUAL" : "WEB",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    bookingId: result.data.id,
    manageToken: result.data.manageToken,
  });
}
