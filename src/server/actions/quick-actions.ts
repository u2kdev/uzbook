"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/server/db";
import {
  bookings,
  businesses,
  scheduleExceptions,
  services,
  staff,
} from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { zonedToUtc } from "@/server/booking/time";
import { newManageToken } from "@/server/booking/service";

export type QuickActionResult = {
  ok: boolean;
  error?: string;
};

/**
 * Quick block time for a staff member (e.g. lunch, personal errands, break).
 * Creates a confirmed booking marked as a time block so slots become unavailable.
 */
export async function blockTimeAction(input: {
  staffId: string;
  date: string;
  startMinute: number;
  endMinute: number;
  reason: string;
}): Promise<QuickActionResult> {
  const session = await requireUser();
  if (session.role !== "OWNER") return { ok: false, error: "Нет доступа" };

  const db = await getDb();
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.ownerId, session.id))
    .limit(1);

  if (!business) return { ok: false, error: "Бизнес не найден" };

  if (input.endMinute <= input.startMinute) {
    return { ok: false, error: "Время окончания должно быть позже времени начала" };
  }

  // Ensure staff belongs to this business
  const [member] = await db
    .select()
    .from(staff)
    .where(and(eq(staff.id, input.staffId), eq(staff.businessId, business.id)))
    .limit(1);

  if (!member) return { ok: false, error: "Мастер не найден" };

  // Find or create a system service for blocks if needed, or use any existing service
  let [anyService] = await db
    .select()
    .from(services)
    .where(eq(services.businessId, business.id))
    .limit(1);

  if (!anyService) {
    // Create a lightweight internal service for time blocks
    const [createdService] = await db
      .insert(services)
      .values({
        businessId: business.id,
        name: "Перерыв / Блокировка",
        price: 0,
        durationMin: Math.max(15, input.endMinute - input.startMinute),
        isActive: false, // hidden from public catalog
      })
      .returning();
    anyService = createdService;
  }

  const startAt = zonedToUtc(input.date, input.startMinute, business.timezone);
  const endAt = zonedToUtc(input.date, input.endMinute, business.timezone);
  const durationMin = Math.max(5, input.endMinute - input.startMinute);
  const reasonText = input.reason.trim() || "Перерыв";

  await db.insert(bookings).values({
    businessId: business.id,
    staffId: member.id,
    serviceId: anyService.id,
    clientName: "🔒 Блокировка времени",
    clientPhone: "-",
    startAt,
    endAt,
    status: "CONFIRMED",
    source: "MANUAL",
    price: 0,
    durationMin,
    note: `[БЛОКИРОВКА] ${reasonText}`,
    manageToken: newManageToken(),
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/bookings");
  revalidatePath(`/${business.slug}`);
  return { ok: true };
}

/**
 * Toggle a day off for a staff member or all staff members on a specific date.
 */
export async function toggleDayOffAction(input: {
  staffId: string; // or "all"
  date: string;
  isClosed: boolean;
}): Promise<QuickActionResult> {
  const session = await requireUser();
  if (session.role !== "OWNER") return { ok: false, error: "Нет доступа" };

  const db = await getDb();
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.ownerId, session.id))
    .limit(1);

  if (!business) return { ok: false, error: "Бизнес не найден" };

  const staffRows = await db
    .select({ id: staff.id })
    .from(staff)
    .where(eq(staff.businessId, business.id));

  const targetStaffIds =
    input.staffId === "all"
      ? staffRows.map((s) => s.id)
      : staffRows.filter((s) => s.id === input.staffId).map((s) => s.id);

  if (targetStaffIds.length === 0) {
    return { ok: false, error: "Мастер не найден" };
  }

  for (const staffId of targetStaffIds) {
    if (input.isClosed) {
      // Upsert closed exception
      await db
        .insert(scheduleExceptions)
        .values({
          staffId,
          date: input.date,
          isClosed: true,
          startMinute: null,
          endMinute: null,
        })
        .onConflictDoUpdate({
          target: [scheduleExceptions.staffId, scheduleExceptions.date],
          set: { isClosed: true, startMinute: null, endMinute: null },
        });
    } else {
      // Remove exception to restore regular schedule
      await db
        .delete(scheduleExceptions)
        .where(
          and(
            eq(scheduleExceptions.staffId, staffId),
            eq(scheduleExceptions.date, input.date),
          ),
        );
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/staff");
  revalidatePath(`/${business.slug}`);
  return { ok: true };
}
