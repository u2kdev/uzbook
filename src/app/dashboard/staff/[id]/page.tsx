import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { bookings, scheduleExceptions, staff, staffServices, workingHours } from "@/server/db/schema";
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

  const [serviceLinks, hours, exceptions, services, bookingRows] = await Promise.all([
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
    db
      .select({
        id: scheduleExceptions.id,
        date: scheduleExceptions.date,
        isClosed: scheduleExceptions.isClosed,
        startMinute: scheduleExceptions.startMinute,
        endMinute: scheduleExceptions.endMinute,
      })
      .from(scheduleExceptions)
      .where(eq(scheduleExceptions.staffId, member.id))
      .orderBy(asc(scheduleExceptions.date)),
    getOwnerServices(business.id),
    db
      .select({
        price: bookings.price,
        status: bookings.status,
        durationMin: bookings.durationMin,
      })
      .from(bookings)
      .where(eq(bookings.staffId, member.id)),
  ]);

  const completed = bookingRows.filter((b) => b.status === "COMPLETED" || b.status === "CONFIRMED");
  const totalRevenue = completed.reduce((sum, b) => sum + b.price, 0);
  const totalMinutes = completed.reduce((sum, b) => sum + b.durationMin, 0);

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
      exceptions={exceptions}
      stats={{
        totalBookings: bookingRows.length,
        completedVisits: completed.length,
        totalRevenue,
        totalHours: Math.round((totalMinutes / 60) * 10) / 10,
      }}
      currency={business.currency}
    />
  );
}
