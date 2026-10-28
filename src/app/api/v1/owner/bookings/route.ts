import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db";
import { bookings, services, staff } from "@/server/db/schema";
import { authenticateBearer } from "@/server/api/v1/auth";
import {
  apiError,
  apiSuccess,
  checkApiRateLimit,
  handleApiError,
} from "@/server/api/v1/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  status: z
    .enum(["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"])
    .optional(),
  staffId: z.string().uuid().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(request: Request) {
  const rateLimitErr = checkApiRateLimit(request, "owner_bookings", 60, 60_000);
  if (rateLimitErr) return rateLimitErr;

  try {
    const { business } = await authenticateBearer(request);
    const url = new URL(request.url);

    const parsed = querySchema.safeParse({
      status: url.searchParams.get("status") ?? undefined,
      staffId: url.searchParams.get("staffId") ?? undefined,
      fromDate: url.searchParams.get("fromDate") ?? undefined,
      toDate: url.searchParams.get("toDate") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      offset: url.searchParams.get("offset") ?? undefined,
    });

    if (!parsed.success) {
      return apiError(
        "validation_error",
        parsed.error.issues[0]?.message ?? "Неверные параметры фильтрации",
        422,
        parsed.error.issues,
      );
    }

    const { status, staffId, fromDate, toDate, limit, offset } = parsed.data;
    const db = await getDb();

    const conditions = [eq(bookings.businessId, business.id)];
    if (status) conditions.push(eq(bookings.status, status));
    if (staffId) conditions.push(eq(bookings.staffId, staffId));
    if (fromDate) conditions.push(gte(bookings.startAt, new Date(fromDate)));
    if (toDate) conditions.push(lte(bookings.startAt, new Date(toDate)));

    const rows = await db
      .select({
        id: bookings.id,
        manageToken: bookings.manageToken,
        status: bookings.status,
        startAt: bookings.startAt,
        endAt: bookings.endAt,
        clientName: bookings.clientName,
        clientPhone: bookings.clientPhone,
        clientEmail: bookings.clientEmail,
        clientNote: bookings.note,
        source: bookings.source,
        cancelReason: bookings.cancelReason,
        serviceId: services.id,
        serviceName: services.name,
        servicePrice: services.price,
        serviceDurationMin: services.durationMin,
        staffId: staff.id,
        staffName: staff.name,
        staffColor: staff.color,
      })
      .from(bookings)
      .innerJoin(services, eq(bookings.serviceId, services.id))
      .innerJoin(staff, eq(bookings.staffId, staff.id))
      .where(and(...conditions))
      .orderBy(desc(bookings.startAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookings)
      .where(and(...conditions));

    return apiSuccess(
      {
        total: count,
        limit,
        offset,
        bookings: rows.map((r) => ({
          id: r.id,
          manageToken: r.manageToken,
          status: r.status,
          startAt: r.startAt.toISOString(),
          endAt: r.endAt.toISOString(),
          source: r.source,
          cancelReason: r.cancelReason,
          client: {
            name: r.clientName,
            phone: r.clientPhone,
            email: r.clientEmail,
            note: r.clientNote,
          },
          service: {
            id: r.serviceId,
            name: r.serviceName,
            price: r.servicePrice,
            durationMin: r.serviceDurationMin,
          },
          staff: {
            id: r.staffId,
            name: r.staffName,
            color: r.staffColor,
          },
        })),
      },
      { total: count, page: Math.floor(offset / limit) + 1 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
