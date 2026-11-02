import { NextResponse } from "next/server";
import { z } from "zod";
import { getBusinessBySlug } from "@/server/business/public";
import { createBooking, normalizePhone } from "@/server/booking/service";
import { getSession } from "@/server/auth/session";
import { clientIp, rateLimit } from "@/server/http/rate-limit";

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
  const ip = clientIp(request);
  const ipLimit = rateLimit(`pub_booking_ip:${ip}`, 20, 60_000);
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: {
          "retry-after": String(Math.max(1, Math.ceil((ipLimit.resetAt - Date.now()) / 1000))),
        },
      },
    );
  }

  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business || business.status !== "ACTIVE") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const isTrialExpired =
    business.plan === "TRIAL" &&
    Boolean(business.trialEndsAt) &&
    (business.trialEndsAt as Date).getTime() < Date.now();
  if (isTrialExpired) {
    return NextResponse.json(
      {
        error: "trial_expired",
        message: "Бесплатный период салона истёк. Страница онлайн-записи временно отключена.",
      },
      { status: 403 },
    );
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

  const normalizedPhone = normalizePhone(parsed.data.phone);
  const phoneLimit = rateLimit(`pub_booking_phone:${normalizedPhone}`, 6, 10 * 60_000);
  if (!phoneLimit.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const session = await getSession();
  const isAuthorizedOwner = Boolean(
    session && (session.id === business.ownerId || session.role === "ADMIN"),
  );
  const source: "WEB" | "MANUAL" = isAuthorizedOwner ? "MANUAL" : "WEB";

  const result = await createBooking({
    business,
    staffId: parsed.data.staffId,
    serviceId: parsed.data.serviceId,
    startAt: parsed.data.startAt,
    name: parsed.data.name,
    phone: parsed.data.phone,
    email: parsed.data.email || null,
    note: parsed.data.note || null,
    source,
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
