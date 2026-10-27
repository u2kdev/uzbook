import { getMyBusiness } from "@/server/auth/session";
import { getOwnerServices, getOwnerStaff } from "@/server/business/public";
import { StaffManager } from "@/components/dashboard/staff-manager";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const { business } = await getMyBusiness();
  if (!business) return null;

  const [staff, services] = await Promise.all([
    getOwnerStaff(business.id),
    getOwnerServices(business.id),
  ]);

  return (
    <StaffManager
      staff={staff.map((member) => ({
        id: member.id,
        name: member.name,
        title: member.title,
        color: member.color,
        isActive: member.isActive,
        photoUrl: member.photoUrl,
        serviceCount: member.serviceIds.length,
      }))}
      services={services.map((service) => ({
        id: service.id,
        name: service.name,
        isActive: service.isActive,
      }))}
    />
  );
}
