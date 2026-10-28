import { authenticateBearer } from "@/server/api/v1/auth";
import {
  apiSuccess,
  checkApiRateLimit,
  handleApiError,
} from "@/server/api/v1/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rateLimitErr = checkApiRateLimit(request, "auth_me", 60, 60_000);
  if (rateLimitErr) return rateLimitErr;

  try {
    const { user, business } = await authenticateBearer(request);

    return apiSuccess({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        telegramId: user.telegramId,
      },
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        category: business.category,
        phone: business.phone,
        address: business.address,
        city: business.city,
        plan: business.plan,
        currency: business.currency,
        settings: business.settings,
        theme: business.theme,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
