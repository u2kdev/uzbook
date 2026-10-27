import { and, eq, gt, inArray, lt, ne } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  bookings,
  services,
  staff,
  scheduleExceptions,
  workingHours,
  type BusinessSettings,
} from "@/server/db/schema";
import { addDays, todayInZone, weekdayOf, zonedToUtc } from "./time";

export type TimeSlot = {
  start: string;
  end: string;
  label: string;
  staffId: string;
};

type ComputeInput = {
  staffId: string;
  date: string;
  timezone: string;
  settings: BusinessSettings;
  durationMin: number;
  bufferBeforeMin?: number;
  bufferAfterMin?: number;
  excludeBookingId?: string;
  now?: Date;
};

type Interval = { start: number; end: number };

/** Core availability engine. Pure schedule + bookings math for one staff member. */
async function computeSlots(input: ComputeInput): Promise<TimeSlot[]> {
  const db = await getDb();
  const {
    staffId,
    date,
    timezone,
    settings,
    durationMin,
    bufferBeforeMin = 0,
    bufferAfterMin = 0,
  } = input;
  const now = input.now ?? new Date();

  const [member] = await db.select().from(staff).where(eq(staff.id, staffId)).limit(1);
  if (!member || !member.isActive) return [];

  // Booking horizon: the last bookable day is today + maxAdvanceDays.
  const lastBookableDay = addDays(todayInZone(timezone), Math.max(0, settings.maxAdvanceDays));
  if (zonedToUtc(date, 0, timezone) > zonedToUtc(lastBookableDay, 0, timezone)) return [];

  const weekday = weekdayOf(date);
  const [exception] = await db
    .select()
    .from(scheduleExceptions)
    .where(and(eq(scheduleExceptions.staffId, staffId), eq(scheduleExceptions.date, date)))
    .limit(1);

  let rawIntervals: { startMinute: number; endMinute: number }[] = [];
  if (exception) {
    if (!exception.isClosed && exception.startMinute != null && exception.endMinute != null) {
      rawIntervals = [{ startMinute: exception.startMinute, endMinute: exception.endMinute }];
    }
  } else {
    rawIntervals = await db
      .select({
        startMinute: workingHours.startMinute,
        endMinute: workingHours.endMinute,
      })
      .from(workingHours)
      .where(and(eq(workingHours.staffId, staffId), eq(workingHours.weekday, weekday)));
  }

  if (rawIntervals.length === 0) return [];

  const intervals: Interval[] = rawIntervals
    .map((i) => ({
      start: zonedToUtc(date, i.startMinute, timezone).getTime(),
      end: zonedToUtc(date, i.endMinute, timezone).getTime(),
    }))
    .sort((a, b) => a.start - b.start);

  const dayStart = intervals[0].start;
  const dayEnd = intervals[intervals.length - 1].end;

  const busyRows = await db
    .select({
      startAt: bookings.startAt,
      endAt: bookings.endAt,
      bufferBefore: services.bufferBeforeMin,
      bufferAfter: services.bufferAfterMin,
    })
    .from(bookings)
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(
      and(
        eq(bookings.staffId, staffId),
        inArray(bookings.status, ["PENDING", "CONFIRMED"]),
        lt(bookings.startAt, new Date(dayEnd + 86_400_000)),
        gt(bookings.endAt, new Date(dayStart - 86_400_000)),
        input.excludeBookingId ? ne(bookings.id, input.excludeBookingId) : undefined,
      ),
    );

  const busy: Interval[] = busyRows.map((row) => ({
    start: row.startAt.getTime() - row.bufferBefore * 60_000,
    end: row.endAt.getTime() + row.bufferAfter * 60_000,
  }));

  const stepMs = Math.max(5, settings.slotStepMin) * 60_000;
  const durationMs = durationMin * 60_000;
  const bufBeforeMs = bufferBeforeMin * 60_000;
  const bufAfterMs = bufferAfterMin * 60_000;
  const earliest = now.getTime() + settings.leadTimeMin * 60_000;

  const slots: TimeSlot[] = [];

  for (const interval of intervals) {
    // Align the first candidate to the grid of the business day.
    let cursor = Math.max(interval.start, Math.ceil(interval.start / stepMs) * stepMs);
    while (cursor + durationMs + bufAfterMs <= interval.end) {
      const occupiedStart = cursor - bufBeforeMs;
      const occupiedEnd = cursor + durationMs + bufAfterMs;

      const fits = occupiedStart >= interval.start && cursor >= earliest;
      const free = !busy.some((b) => occupiedStart < b.end && occupiedEnd > b.start);

      if (fits && free) {
        slots.push({
          start: new Date(cursor).toISOString(),
          end: new Date(cursor + durationMs).toISOString(),
          label: new Intl.DateTimeFormat("ru-RU", {
            timeZone: timezone,
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(new Date(cursor)),
          staffId,
        });
      }
      cursor += stepMs;
    }
  }

  return slots;
}

/** Free slots for one staff member and one service on a given day. */
export async function getAvailableSlots(query: {
  staffId: string;
  serviceId: string;
  date: string;
  timezone: string;
  settings: BusinessSettings;
  excludeBookingId?: string;
  now?: Date;
}): Promise<TimeSlot[]> {
  const db = await getDb();
  const [service] = await db
    .select()
    .from(services)
    .where(eq(services.id, query.serviceId))
    .limit(1);
  if (!service || !service.isActive) return [];

  return computeSlots({
    ...query,
    durationMin: service.durationMin,
    bufferBeforeMin: service.bufferBeforeMin,
    bufferAfterMin: service.bufferAfterMin,
  });
}

/** Rough "next free time" preview for the public page (no service selected yet). */
export async function getPreviewSlots(
  staffId: string,
  date: string,
  timezone: string,
  settings: BusinessSettings,
  limit = 4,
): Promise<TimeSlot[]> {
  const slots = await computeSlots({
    staffId,
    date,
    timezone,
    settings,
    durationMin: 30,
    bufferAfterMin: 0,
  });
  return slots.slice(0, limit);
}
