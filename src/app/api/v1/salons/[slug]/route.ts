import { getPublicBusiness } from "@/server/business/public";
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
  { params }: { params: Promise<{ slug: string }> },
) {
  const rateLimitErr = checkApiRateLimit(request, "salons_get", 120, 60_000);
  if (rateLimitErr) return rateLimitErr;

  try {
    const { slug } = await params;
    if (!slug) return apiError("bad_request", "Slug салона обязателен", 400);

    const data = await getPublicBusiness(slug);
    if (!data) {
      return apiError("not_found", "Салон не найден или неактивен", 404);
    }

    const { business, services, staff, categories, gallery } = data;

    return apiSuccess({
      salon: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        category: business.category,
        description: business.description,
        phone: business.phone,
        address: business.address,
        city: business.city,
        timezone: business.timezone,
        currency: business.currency,
        settings: business.settings,
        theme: business.theme,
      },
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        durationMin: s.durationMin,
        price: s.price,
        description: s.description,
      })),
      staff: staff.map((st) => ({
        id: st.id,
        name: st.name,
        title: st.title,
        bio: st.bio,
        photoUrl: st.photoUrl,
        serviceIds: st.serviceIds,
      })),
      categories,
      gallery,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
