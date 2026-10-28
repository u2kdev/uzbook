import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db";
import { bookings, businesses, services, staff } from "@/server/db/schema";
import { getBusinessBySlug } from "@/server/business/public";
import { createBooking, normalizePhone } from "@/server/booking/service";
import { appUrl } from "@/server/payments/config";
import {
  apiError,
  apiSuccess,
  checkApiRateLimit,
  handleApiError,
} from "@/server/api/v1/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createBookingSchema = z.object({
  slug: z.string().min(1, "Slug салона обязателен"),
  staffId: z.string().uuid("Неверный ID мастера"),
  serviceId: z.string().uuid("Неверный ID услуги"),
  startAt: z.string().datetime({ message: "startAt должен быть датой в формате ISO-8601" }),
  name: z.string().trim().min(2, "Имя должно содержать минимум 2 символа").max(120),
  phone: z.string().trim().min(7, "Номер телефона слишком короткий").max(30),
  email: z.string().trim().email("Неверный email").optional().or(z.literal("")),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function POST(request: Request) {
  const rateLimitErr = checkApiRateLimit(request, "bookings_create", 30, 60_000);
  if (rateLimitErr) return rateLimitErr;

  try {
    const json = await request.json().catch(() => null);
    const parsed = createBookingSchema.safeParse(json);
    if (!parsed.success) {
      return apiError(
        "validation_error",
        parsed.error.issues[0]?.message ?? "Неверные данные записи",
        422,
        parsed.error.issues,
      );
    }

    const { slug, staffId, serviceId, startAt, name, phone, email, note } = parsed.data;

    const business = await getBusinessBySlug(slug);
    if (!business || business.status !== "ACTIVE") {
      return apiError("not_found", "Салон не найден или неактивен", 404);
    }

    const result = await createBooking({
      business,
      staffId,
      serviceId,
      startAt,
      name,
      phone,
      email: email || null,
      note: note || null,
      source: "WEB",
    });

    if (!result.ok) {
      const errorMap: Record<string, { code: string; message: string; status: number }> = {
        service_not_found: { code: "service_not_found", message: "Услуга не найдена", status: 404 },
        staff_not_found: { code: "staff_not_found", message: "Мастер не найден", status: 404 },
        staff_does_not_provide_service: {
          code: "staff_mismatch",
          message: "Мастер не выполняет данную услугу",
          status: 400,
        },
        slot_unavailable: {
          code: "slot_unavailable",
          message: "Выбранное время уже занято или недоступно",
          status: 409,
        },
        invalid_input: { code: "invalid_input", message: "Неверная дата или параметры", status: 422 },
      };

      const mapped = errorMap[result.error] ?? {
        code: result.error,
        message: "Не удалось создать запись",
        status: 400,
      };

      return apiError(mapped.code, mapped.message, mapped.status);
    }

    const manageUrl = `${appUrl()}/b/${result.data.manageToken}`;

    return apiSuccess(
      {
        booking: {
          id: result.data.id,
          manageToken: result.data.manageToken,
          startAt: result.data.startAt.toISOString(),
          endAt: result.data.endAt.toISOString(),
        },
        manageUrl,
      },
      undefined,
      201,
    );
  } catch (err) {
    return handleApiError(err);
  }
}

export async function GET(request: Request) {
  const rateLimitErr = checkApiRateLimit(request, "bookings_lookup_phone", 20, 60_000);
  if (rateLimitErr) return rateLimitErr;

  try {
    const url = new URL(request.url);
    const rawPhone = url.searchParams.get("phone")?.trim();

    if (!rawPhone || rawPhone.length < 7) {
      return apiError("bad_request", "Укажите корректный номер телефона (параметр phone)", 400);
    }

    const normalized = normalizePhone(rawPhone);
    const db = await getDb();

    const rows = await db
      .select({
        id: bookings.id,
        manageToken: bookings.manageToken,
        status: bookings.status,
        startAt: bookings.startAt,
        endAt: bookings.endAt,
        clientName: bookings.clientName,
        clientPhone: bookings.clientPhone,
        serviceName: services.name,
        servicePrice: services.price,
        serviceDurationMin: services.durationMin,
        staffName: staff.name,
        businessName: businesses.name,
        businessSlug: businesses.slug,
        businessAddress: businesses.address,
        businessPhone: businesses.phone,
      })
      .from(bookings)
      .innerJoin(services, eq(bookings.serviceId, services.id))
      .innerJoin(staff, eq(bookings.staffId, staff.id))
      .innerJoin(businesses, eq(bookings.businessId, businesses.id))
      .where(eq(bookings.clientPhone, normalized))
      .orderBy(desc(bookings.startAt))
      .limit(50);

    return apiSuccess({
      phone: normalized,
      count: rows.length,
      bookings: rows.map((r) => ({
        id: r.id,
        manageToken: r.manageToken,
        manageUrl: `${appUrl()}/b/${r.manageToken}`,
        status: r.status,
        startAt: r.startAt.toISOString(),
        endAt: r.endAt.toISOString(),
        clientName: r.clientName,
        clientPhone: r.clientPhone,
        service: {
          name: r.serviceName,
          price: r.servicePrice,
          durationMin: r.serviceDurationMin,
        },
        staff: {
          name: r.staffName,
        },
        salon: {
          name: r.businessName,
          slug: r.businessSlug,
          address: r.businessAddress,
          phone: r.businessPhone,
        },
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
