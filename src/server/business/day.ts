import { and, eq, inArray, gte, lt, ne } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  bookings,
  services,
  staff,
  workingHours,
  type Business,
} from "@/server/db/schema";
import { weekdayOf, zonedToUtc } from "@/server/booking/time";

export type DayBooking = {
  id: string;
  startAt: Date;
  endAt: Date;
  status: string;
  source: string;
  price: number;
  durationMin: number;
  clientName: string;
  clientPhone: string;
  note: string | null;
  staffId: string;
  staffName: string;
  staffColor: string;
  serviceName: string;
  manageToken: string;
};

export async function getDaySchedule(business: Business, date: string) {
  const db = await getDb();
  const weekday = weekdayOf(date);
  const dayStart = zonedToUtc(date, 0, business.timezone);
  const dayEnd = zonedToUtc(date, 24 * 60, business.timezone);

  const staffRows = await db
    .select()
    .from(staff)
    .where(and(eq(staff.businessId, business.id), eq(staff.isActive, true)))
    .orderBy(staff.sortOrder, staff.name);

  const staffIds = staffRows.map((s) => s.id);

  const [hourRows, bookingRows] = await Promise.all([
    staffIds.length
      ? db
          .select()
          .from(workingHours)
          .where(
            and(inArray(workingHours.staffId, staffIds), eq(workingHours.weekday, weekday)),
          )
      : Promise.resolve([]),
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
      .where(
        and(
          eq(bookings.businessId, business.id),
          gte(bookings.startAt, dayStart),
          lt(bookings.startAt, dayEnd),
        ),
      )
      .orderBy(bookings.startAt),
  ]);

  const dayBookings: DayBooking[] = bookingRows.map((row) => ({
    id: row.booking.id,
    startAt: row.booking.startAt,
    endAt: row.booking.endAt,
    status: row.booking.status,
    source: row.booking.source,
    price: row.booking.price,
    durationMin: row.booking.durationMin,
    clientName: row.booking.clientName,
    clientPhone: row.booking.clientPhone,
    note: row.booking.note,
    staffId: row.booking.staffId,
    staffName: row.staffName,
    staffColor: row.staffColor,
    serviceName: row.serviceName,
    manageToken: row.booking.manageToken,
  }));

  const hoursByStaff = new Map<string, { startMinute: number; endMinute: number }[]>();
  for (const row of hourRows) {
    const list = hoursByStaff.get(row.staffId) ?? [];
    list.push({ startMinute: row.startMinute, endMinute: row.endMinute });
    hoursByStaff.set(row.staffId, list);
  }

  return { staff: staffRows, bookings: dayBookings, hoursByStaff, weekday };
}

export function dayStats(
  business: Business,
  schedule: Awaited<ReturnType<typeof getDaySchedule>>,
  now = new Date(),
) {
  const all = schedule.bookings;
  const active = all.filter((b) => b.status !== "CANCELLED");
  const confirmed = all.filter((b) => b.status === "CONFIRMED");
  const completed = all.filter((b) => b.status === "COMPLETED");
  const noShow = all.filter((b) => b.status === "NO_SHOW");
  const cancelled = all.filter((b) => b.status === "CANCELLED");
  const pending = all.filter((b) => b.status === "PENDING");

  // Late arrivals: confirmed bookings whose start time passed over 10 minutes ago
  const nowMs = now.getTime();
  const late = confirmed.filter(
    (b) => nowMs - b.startAt.getTime() > 10 * 60_000 && nowMs < b.endAt.getTime() + 60 * 60_000,
  );

  const expectedRevenue = active.reduce((sum, b) => sum + b.price, 0);
  const actualRevenue = completed.reduce((sum, b) => sum + b.price, 0);
  const bookedMinutes = active.reduce((sum, b) => sum + b.durationMin, 0);

  let workingMinutes = 0;
  for (const member of schedule.staff) {
    const hours = schedule.hoursByStaff.get(member.id) ?? [];
    for (const h of hours) workingMinutes += Math.max(0, h.endMinute - h.startMinute);
  }

  const freeMinutes = Math.max(0, workingMinutes - bookedMinutes);
  const load =
    workingMinutes > 0 ? Math.min(100, Math.round((bookedMinutes / workingMinutes) * 100)) : 0;

  return {
    count: active.length,
    totalBookings: all.length,
    confirmed: confirmed.length,
    completed: completed.length,
    noShow: noShow.length,
    cancelled: cancelled.length,
    pending: pending.length,
    late: late.length,
    revenue: expectedRevenue,
    actualRevenue,
    bookedMinutes,
    freeMinutes,
    workingMinutes,
    load,
  };
}
