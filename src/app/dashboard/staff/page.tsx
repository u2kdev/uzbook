import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { bookings } from "@/server/db/schema";
import { getMyBusiness } from "@/server/auth/session";
import { getOwnerServices, getOwnerStaff } from "@/server/business/public";
import { StaffManager } from "@/components/dashboard/staff-manager";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const { business } = await getMyBusiness();
  if (!business) return null;

  const db = await getDb();

  const [staff, services, bookingRows] = await Promise.all([
    getOwnerStaff(business.id),
    getOwnerServices(business.id),
    db
      .select({
        staffId: bookings.staffId,
        price: bookings.price,
        status: bookings.status,
      })
      .from(bookings)
      .where(eq(bookings.businessId, business.id)),
  ]);

  const statsByStaff = new Map<string, { revenue: number; completedCount: number }>();
  for (const b of bookingRows) {
    if (b.staffId && (b.status === "COMPLETED" || b.status === "CONFIRMED")) {
      const current = statsByStaff.get(b.staffId) ?? { revenue: 0, completedCount: 0 };
      current.revenue += b.price;
      current.completedCount += 1;
      statsByStaff.set(b.staffId, current);
    }
  }

  return (
    <StaffManager
      currency={business.currency}
      staff={staff.map((member) => {
        const stats = statsByStaff.get(member.id) ?? { revenue: 0, completedCount: 0 };
        return {
          id: member.id,
          name: member.name,
          title: member.title,
          color: member.color,
          isActive: member.isActive,
          photoUrl: member.photoUrl,
          serviceCount: member.serviceIds.length,
          revenue: stats.revenue,
          completedCount: stats.completedCount,
        };
      })}
      services={services.map((service) => ({
        id: service.id,
        name: service.name,
        isActive: service.isActive,
      }))}
    />
  );
}
