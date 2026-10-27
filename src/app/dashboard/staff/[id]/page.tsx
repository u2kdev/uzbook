import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { staff, staffServices, workingHours } from "@/server/db/schema";
import { getMyBusiness } from "@/server/auth/session";
import { getOwnerServices } from "@/server/business/public";
import { StaffEditor } from "@/components/dashboard/staff-editor";

export const dynamic = "force-dynamic";

export default async function StaffMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { business } = await getMyBusiness();
  if (!business) return null;

  const db = await getDb();

  const [member] = await db
    .select()
    .from(staff)
    .where(and(eq(staff.id, id), eq(staff.businessId, business.id)))
    .limit(1);

  if (!member) notFound();

  const [serviceLinks, hours, services] = await Promise.all([
    db
      .select({ serviceId: staffServices.serviceId })
      .from(staffServices)
      .where(eq(staffServices.staffId, member.id)),
    db
      .select({
        weekday: workingHours.weekday,
        startMinute: workingHours.startMinute,
        endMinute: workingHours.endMinute,
      })
      .from(workingHours)
      .where(eq(workingHours.staffId, member.id))
      .orderBy(asc(workingHours.weekday)),
    getOwnerServices(business.id),
  ]);

  return (
    <StaffEditor
      member={{
        id: member.id,
        name: member.name,
        title: member.title,
        bio: member.bio,
        color: member.color,
        isActive: member.isActive,
        serviceIds: serviceLinks.map((l) => l.serviceId),
      }}
      services={services.map((s) => ({
        id: s.id,
        name: s.name,
        isActive: s.isActive,
      }))}
      schedule={hours}
    />
  );
}
