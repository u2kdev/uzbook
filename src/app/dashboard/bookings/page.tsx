import { and, asc, eq, gte } from "drizzle-orm";
import { getDb } from "@/server/db";
import { bookings, services, staff } from "@/server/db/schema";
import { getMyBusiness } from "@/server/auth/session";
import { todayInZone } from "@/server/booking/time";
import { BookingsManager } from "@/components/dashboard/bookings-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Записи" };

export default async function BookingsPage() {
  const { business } = await getMyBusiness();
  if (!business) return null;

  const db = await getDb();
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const [rows, serviceRows, staffRows] = await Promise.all([
    db
      .select({
        booking: bookings,
        serviceName: services.name,
        staffName: staff.name,
        staffColor: staff.color,
      })
      .from(bookings)
      .innerJoin(services, eq(bookings.serviceId, services.id))
      .innerJoin(staff, eq(bookings.staffId, staff.id))
      .where(and(eq(bookings.businessId, business.id), gte(bookings.startAt, since)))
      .orderBy(asc(bookings.startAt))
      .limit(500),
    db
      .select()
      .from(services)
      .where(and(eq(services.businessId, business.id), eq(services.isActive, true)))
      .orderBy(asc(services.sortOrder), asc(services.name)),
    db
      .select()
      .from(staff)
      .where(and(eq(staff.businessId, business.id), eq(staff.isActive, true)))
      .orderBy(asc(staff.sortOrder), asc(staff.name)),
  ]);

  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

  return (
    <BookingsManager
      slug={business.slug}
      timezone={business.timezone}
      currency={business.currency}
      appUrl={appUrl}
      today={todayInZone(business.timezone)}
      bookings={rows.map(({ booking, serviceName, staffName, staffColor }) => ({
        id: booking.id,
        startAt: booking.startAt.toISOString(),
        endAt: booking.endAt.toISOString(),
        status: booking.status,
        source: booking.source,
        price: booking.price,
        durationMin: booking.durationMin,
        clientName: booking.clientName,
        clientPhone: booking.clientPhone,
        clientEmail: booking.clientEmail,
        note: booking.note,
        manageToken: booking.manageToken,
        serviceId: booking.serviceId,
        serviceName,
        staffId: booking.staffId,
        staffName,
        staffColor,
      }))}
      services={serviceRows.map((service) => ({
        id: service.id,
        name: service.name,
        durationMin: service.durationMin,
        price: service.price,
      }))}
      staff={staffRows.map((member) => ({
        id: member.id,
        name: member.name,
        color: member.color,
        title: member.title,
      }))}
    />
  );
}
