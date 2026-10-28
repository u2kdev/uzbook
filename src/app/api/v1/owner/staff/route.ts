import { asc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { staff, staffServices } from "@/server/db/schema";
import { authenticateBearer } from "@/server/api/v1/auth";
import {
  apiSuccess,
  checkApiRateLimit,
  handleApiError,
} from "@/server/api/v1/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rateLimitErr = checkApiRateLimit(request, "owner_staff", 60, 60_000);
  if (rateLimitErr) return rateLimitErr;

  try {
    const { business } = await authenticateBearer(request);
    const db = await getDb();

    const [staffRows, links] = await Promise.all([
      db
        .select()
        .from(staff)
        .where(eq(staff.businessId, business.id))
        .orderBy(asc(staff.sortOrder), asc(staff.name)),
      db
        .select({ staffId: staffServices.staffId, serviceId: staffServices.serviceId })
        .from(staffServices)
        .innerJoin(staff, eq(staffServices.staffId, staff.id))
        .where(eq(staff.businessId, business.id)),
    ]);

    const serviceIdsByStaff = new Map<string, string[]>();
    for (const l of links) {
      const list = serviceIdsByStaff.get(l.staffId) ?? [];
      list.push(l.serviceId);
      serviceIdsByStaff.set(l.staffId, list);
    }

    return apiSuccess({
      count: staffRows.length,
      staff: staffRows.map((st) => ({
        id: st.id,
        name: st.name,
        title: st.title,
        bio: st.bio,
        color: st.color,
        photoUrl: st.photoUrl,
        isActive: st.isActive,
        sortOrder: st.sortOrder,
        serviceIds: serviceIdsByStaff.get(st.id) ?? [],
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
