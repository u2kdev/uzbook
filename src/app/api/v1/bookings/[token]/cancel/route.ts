import { z } from "zod";
import { cancelBooking } from "@/server/booking/service";
import {
  apiError,
  apiSuccess,
  checkApiRateLimit,
  handleApiError,
} from "@/server/api/v1/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cancelSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const rateLimitErr = checkApiRateLimit(request, "booking_cancel", 20, 60_000);
  if (rateLimitErr) return rateLimitErr;

  try {
    const { token } = await params;
    if (!token) return apiError("bad_request", "Токен записи обязателен", 400);

    const json = await request.json().catch(() => ({}));
    const parsed = cancelSchema.safeParse(json);
    if (!parsed.success) {
      return apiError(
        "validation_error",
        parsed.error.issues[0]?.message ?? "Неверные параметры",
        422,
      );
    }

    const result = await cancelBooking(token, parsed.data.reason);
    if (!result.ok) {
      if (result.error === "booking_not_found") {
        return apiError("not_found", "Запись не найдена", 404);
      }
      if (result.error === "booking_cancelled") {
        return apiError("already_cancelled", "Запись уже была отменена ранее", 400);
      }
      return apiError("cancel_failed", "Не удалось отменить запись", 400);
    }

    return apiSuccess({
      cancelled: true,
      bookingId: result.data.id,
      message: "Запись успешно отменена",
    });
  } catch (err) {
    return handleApiError(err);
  }
}
