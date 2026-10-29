import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { services, staff, staffServices } from "@/server/db/schema";
import { getBusinessBySlug } from "@/server/business/public";
import { getAvailableSlots } from "@/server/booking/slots";
import { clientIp, rateLimit } from "@/server/http/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const ip = clientIp(request);
  const limit = rateLimit(`pub_availability:${ip}`, 120, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "rate_limited", slots: [] }, { status: 429 });
  }

  const { slug } = await params;
  const url = new URL(request.url);
  const staffId = url.searchParams.get("staffId") ?? "";
  const serviceId = url.searchParams.get("serviceId") ?? "";
  const date = url.searchParams.get("date") ?? "";

  if (!staffId || !serviceId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const business = await getBusinessBySlug(slug);
  if (!business || business.status !== "ACTIVE") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const db = await getDb();
  const [link] = await db
    .select({ staffId: staffServices.staffId })
    .from(staffServices)
    .innerJoin(staff, eq(staffServices.staffId, staff.id))
    .innerJoin(services, eq(staffServices.serviceId, services.id))
    .where(
      and(
        eq(staffServices.staffId, staffId),
        eq(staffServices.serviceId, serviceId),
        eq(staff.businessId, business.id),
        eq(staff.isActive, true),
        eq(services.isActive, true),
      ),
    )
    .limit(1);

  if (!link) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const slots = await getAvailableSlots({
    staffId,
    serviceId,
    date,
    timezone: business.timezone,
    settings: business.settings,
  });

  return NextResponse.json({
    slots: slots.map((slot) => ({ start: slot.start, label: slot.label })),
  });
}
