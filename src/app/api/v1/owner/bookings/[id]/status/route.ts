import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db";
import { bookings } from "@/server/db/schema";
import { authenticateBearer } from "@/server/api/v1/auth";
import {
  apiError,
  apiSuccess,
  checkApiRateLimit,
  handleApiError,
} from "@/server/api/v1/response";
import { notifyBookingCancelled } from "@/server/telegram/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateStatusSchema = z.object({
  status: z.enum(["CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"]),
  reason: z.string().trim().max(300).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimitErr = checkApiRateLimit(request, "owner_booking_status", 40, 60_000);
  if (rateLimitErr) return rateLimitErr;

  try {
    const { business } = await authenticateBearer(request);
    const { id } = await params;

    const json = await request.json().catch(() => null);
    const parsed = updateStatusSchema.safeParse(json);
    if (!parsed.success) {
      return apiError(
        "validation_error",
        parsed.error.issues[0]?.message ?? "Неверный статус",
        422,
      );
    }

    const { status, reason } = parsed.data;
    const db = await getDb();

    const [booking] = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, id), eq(bookings.businessId, business.id)))
      .limit(1);

    if (!booking) {
      return apiError("not_found", "Запись не найдена в вашем салоне", 404);
    }

    const now = new Date();
    await db
      .update(bookings)
      .set({
        status,
        cancelReason: status === "CANCELLED" ? (reason ?? booking.cancelReason) : booking.cancelReason,
        cancelledAt: status === "CANCELLED" ? now : booking.cancelledAt,
        updatedAt: now,
      })
      .where(eq(bookings.id, booking.id));

    if (status === "CANCELLED") {
      void notifyBookingCancelled(booking.id);
    }

    return apiSuccess({
      id: booking.id,
      status,
      updatedAt: now.toISOString(),
      message: `Статус записи обновлен на ${status}`,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
