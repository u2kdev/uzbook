import { z } from "zod";
import { rescheduleBooking } from "@/server/booking/service";
import {
  apiError,
  apiSuccess,
  checkApiRateLimit,
  handleApiError,
} from "@/server/api/v1/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rescheduleSchema = z.object({
  startAt: z.string().datetime({ message: "startAt должен быть датой в формате ISO-8601" }),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const rateLimitErr = checkApiRateLimit(request, "booking_reschedule", 20, 60_000);
  if (rateLimitErr) return rateLimitErr;

  try {
    const { token } = await params;
    if (!token) return apiError("bad_request", "Токен записи обязателен", 400);

    const json = await request.json().catch(() => null);
    const parsed = rescheduleSchema.safeParse(json);
    if (!parsed.success) {
      return apiError(
        "validation_error",
        parsed.error.issues[0]?.message ?? "Неверные параметры",
        422,
      );
    }

    const result = await rescheduleBooking(token, parsed.data.startAt);
    if (!result.ok) {
      const errorMap: Record<string, { code: string; message: string; status: number }> = {
        booking_not_found: { code: "not_found", message: "Запись не найдена", status: 404 },
        booking_cancelled: { code: "booking_cancelled", message: "Нельзя перенести отменённую запись", status: 400 },
        slot_unavailable: { code: "slot_unavailable", message: "Выбранное время уже занято", status: 409 },
        service_not_found: { code: "service_not_found", message: "Услуга не найдена", status: 404 },
        business_not_found: { code: "business_not_found", message: "Салон не найден", status: 404 },
      };

      const mapped = errorMap[result.error] ?? {
        code: result.error,
        message: "Не удалось перенести запись",
        status: 400,
      };

      return apiError(mapped.code, mapped.message, mapped.status);
    }

    return apiSuccess({
      rescheduled: true,
      startAt: result.data.startAt.toISOString(),
      endAt: result.data.endAt.toISOString(),
      message: "Запись успешно перенесена",
    });
  } catch (err) {
    return handleApiError(err);
  }
}
