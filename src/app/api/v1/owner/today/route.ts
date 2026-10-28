import { authenticateBearer } from "@/server/api/v1/auth";
import { todayInZone } from "@/server/booking/time";
import { getDaySchedule, dayStats } from "@/server/business/day";
import {
  apiError,
  apiSuccess,
  checkApiRateLimit,
  handleApiError,
} from "@/server/api/v1/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rateLimitErr = checkApiRateLimit(request, "owner_today", 60, 60_000);
  if (rateLimitErr) return rateLimitErr;

  try {
    const { business } = await authenticateBearer(request);
    const url = new URL(request.url);
    const paramDate = url.searchParams.get("date");
    const date =
      paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate)
        ? paramDate
        : todayInZone(business.timezone);

    const schedule = await getDaySchedule(business, date);
    const stats = dayStats(business, schedule);

    return apiSuccess({
      date,
      timezone: business.timezone,
      currency: business.currency,
      stats: {
        total: stats.totalBookings,
        confirmed: stats.confirmed,
        pending: stats.pending,
        completed: stats.completed,
        cancelled: stats.cancelled,
        noShow: stats.noShow,
        revenue: stats.revenue,
      },
      staff: schedule.staff.map((st) => ({
        id: st.id,
        name: st.name,
        color: st.color,
        photoUrl: st.photoUrl,
      })),
      bookings: schedule.bookings.map((b) => ({
        id: b.id,
        status: b.status,
        startAt: b.startAt.toISOString(),
        endAt: b.endAt.toISOString(),
        clientName: b.clientName,
        clientPhone: b.clientPhone,
        serviceName: b.serviceName,
        price: b.price,
        staffId: b.staffId,
        staffName: b.staffName,
        note: b.note,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
