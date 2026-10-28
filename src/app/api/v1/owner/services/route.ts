import { asc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { services } from "@/server/db/schema";
import { authenticateBearer } from "@/server/api/v1/auth";
import {
  apiSuccess,
  checkApiRateLimit,
  handleApiError,
} from "@/server/api/v1/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rateLimitErr = checkApiRateLimit(request, "owner_services", 60, 60_000);
  if (rateLimitErr) return rateLimitErr;

  try {
    const { business } = await authenticateBearer(request);
    const db = await getDb();

    const rows = await db
      .select()
      .from(services)
      .where(eq(services.businessId, business.id))
      .orderBy(asc(services.sortOrder), asc(services.name));

    return apiSuccess({
      count: rows.length,
      services: rows.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        description: s.description,
        price: s.price,
        durationMin: s.durationMin,
        bufferBeforeMin: s.bufferBeforeMin,
        bufferAfterMin: s.bufferAfterMin,
        isActive: s.isActive,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
