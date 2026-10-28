import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db";
import { services, staff, staffServices } from "@/server/db/schema";
import { getBusinessBySlug } from "@/server/business/public";
import { getAvailableSlots } from "@/server/booking/slots";
import { addDays, todayInZone } from "@/server/booking/time";
import {
  apiError,
  apiSuccess,
  checkApiRateLimit,
  handleApiError,
} from "@/server/api/v1/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  staffId: z.string().uuid("Неверный ID мастера"),
  serviceId: z.string().uuid("Неверный ID услуги"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Дата должна быть в формате YYYY-MM-DD")
    .optional(),
  days: z.coerce.number().int().min(1).max(14).default(1),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const rateLimitErr = checkApiRateLimit(request, "availability_get", 180, 60_000);
  if (rateLimitErr) return rateLimitErr;

  try {
    const { slug } = await params;
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      staffId: url.searchParams.get("staffId"),
      serviceId: url.searchParams.get("serviceId"),
      date: url.searchParams.get("date") ?? undefined,
      days: url.searchParams.get("days") ?? undefined,
    });

    if (!parsed.success) {
      return apiError(
        "validation_error",
        parsed.error.issues[0]?.message ?? "Неверные параметры запроса",
        422,
        parsed.error.issues,
      );
    }

    const { staffId, serviceId, days } = parsed.data;

    const business = await getBusinessBySlug(slug);
    if (!business || business.status !== "ACTIVE") {
      return apiError("not_found", "Салон не найден или неактивен", 404);
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

    if (!link) {
      return apiError(
        "service_staff_mismatch",
        "Выбранный мастер не оказывает данную услугу",
        400,
      );
    }

    const startDate = parsed.data.date ?? todayInZone(business.timezone);
    const results: Array<{ date: string; slots: Array<{ start: string; label: string }> }> = [];

    for (let i = 0; i < days; i++) {
      const curDate = addDays(startDate, i);
      const slots = await getAvailableSlots({
        staffId,
        serviceId,
        date: curDate,
        timezone: business.timezone,
        settings: business.settings,
      });

      results.push({
        date: curDate,
        slots: slots.map((s) => ({ start: s.start, label: s.label })),
      });
    }

    return apiSuccess({
      slug: business.slug,
      staffId,
      serviceId,
      days: results,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
