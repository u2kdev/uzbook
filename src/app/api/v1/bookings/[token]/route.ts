import { getBookingByToken } from "@/server/booking/service";
import { appUrl } from "@/server/payments/config";
import {
  apiError,
  apiSuccess,
  checkApiRateLimit,
  handleApiError,
} from "@/server/api/v1/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const rateLimitErr = checkApiRateLimit(request, "booking_details", 60, 60_000);
  if (rateLimitErr) return rateLimitErr;

  try {
    const { token } = await params;
    if (!token) return apiError("bad_request", "Токен записи обязателен", 400);

    const booking = await getBookingByToken(token);
    if (!booking) {
      return apiError("not_found", "Запись не найдена", 404);
    }

    return apiSuccess({
      ...booking,
      manageUrl: `${appUrl()}/b/${token}`,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
