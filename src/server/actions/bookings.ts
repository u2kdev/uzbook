"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { bookings, businesses, services, staff, staffServices } from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { createBooking } from "@/server/booking/service";
import { notifyBookingCancelled, notifyBookingRescheduled } from "@/server/telegram/notify";

export type StatusActionResult = { ok: boolean; error?: string };

export async function setBookingStatus(
  bookingId: string,
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW",
  reason?: string,
): Promise<StatusActionResult> {
  const session = await requireUser();
  if (session.role !== "OWNER") return { ok: false, error: "Нет доступа" };

  const db = await getDb();
  const [business] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.ownerId, session.id))
    .limit(1);

  if (!business) return { ok: false, error: "Бизнес не найден" };

  const cancelReason = reason?.trim().slice(0, 300) || "Отменено владельцем";

  const updated = await db
    .update(bookings)
    .set({
      status,
      updatedAt: new Date(),
      ...(status === "CANCELLED" ? { cancelledAt: new Date(), cancelReason } : {}),
    })
    .where(and(eq(bookings.id, bookingId), eq(bookings.businessId, business.id)))
    .returning({ id: bookings.id });

  if (updated.length === 0) return { ok: false, error: "Запись не найдена или нет доступа" };

  if (status === "CANCELLED") {
    void notifyBookingCancelled(bookingId);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/bookings");
  return { ok: true };
}

const FAILURE_TEXT: Record<string, string> = {
  business_not_found: "Бизнес не найден",
  service_not_found: "Услуга недоступна",
  staff_not_found: "Мастер недоступен",
  staff_does_not_provide_service: "Этот мастер не оказывает выбранную услугу",
  slot_unavailable: "Это время уже занято — выберите другое",
  invalid_input: "Проверьте имя и телефон",
};

export type ManualBookingState = {
  ok?: boolean;
  error?: string;
  bookingToken?: string;
} | null;

export async function createManualBookingAction(
  _prev: ManualBookingState,
  formData: FormData,
): Promise<ManualBookingState> {
  const session = await requireUser();
  if (session.role !== "OWNER") return { error: "Нет доступа" };

  const db = await getDb();
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.ownerId, session.id))
    .limit(1);
  if (!business) return { error: "Сначала создайте бизнес" };

  const staffId = String(formData.get("staffId") ?? "");
  const serviceId = String(formData.get("serviceId") ?? "");
  const startAt = String(formData.get("startAt") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!staffId || !serviceId || !startAt) return { error: "Выберите услугу, мастера и время" };
  if (name.length < 2) return { error: "Как зовут клиента?" };
  if (phone.replace(/\D/g, "").length < 7) return { error: "Укажите телефон клиента" };

  const result = await createBooking({
    business,
    staffId,
    serviceId,
    startAt,
    name,
    phone,
    email: email || null,
    note: note || null,
    source: "MANUAL",
  });

  if (!result.ok) {
    return { error: FAILURE_TEXT[result.error] ?? "Не удалось создать запись" };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/bookings");
  revalidatePath(`/${business.slug}`);
  return { ok: true, bookingToken: result.data.manageToken };
}

export type RescheduleActionResult = { ok: boolean; error?: string };

export async function ownerRescheduleBookingAction(input: {
  bookingId: string;
  startAt: string;
  staffId?: string;
}): Promise<RescheduleActionResult> {
  const session = await requireUser();
  if (session.role !== "OWNER") return { ok: false, error: "Нет доступа" };

  const db = await getDb();
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.ownerId, session.id))
    .limit(1);
  if (!business) return { ok: false, error: "Бизнес не найден" };

  const [booking] = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.id, input.bookingId), eq(bookings.businessId, business.id)))
    .limit(1);
  if (!booking) return { ok: false, error: "Запись не найдена" };

  const targetStaffId = input.staffId || booking.staffId;
  const start = new Date(input.startAt);
  if (Number.isNaN(start.getTime())) return { ok: false, error: "Некорректная дата" };

  const [service] = await db
    .select()
    .from(services)
    .where(eq(services.id, booking.serviceId))
    .limit(1);
  if (!service) return { ok: false, error: "Услуга не найдена" };

  // If staff is changing, verify that the new staff provides this service
  if (targetStaffId !== booking.staffId) {
    const [provides] = await db
      .select()
      .from(staffServices)
      .where(and(eq(staffServices.staffId, targetStaffId), eq(staffServices.serviceId, service.id)))
      .limit(1);
    if (!provides) return { ok: false, error: "Этот мастер не оказывает данную услугу" };
  }

  const end = new Date(start.getTime() + service.durationMin * 60_000);
  const occupiedStart = start.getTime() - service.bufferBeforeMin * 60_000;
  const occupiedEnd = end.getTime() + service.bufferAfterMin * 60_000;

  const moved = await db.transaction(async (tx) => {
    await tx.execute(sql`select id from staff where id = ${targetStaffId} for update`);
    const nearby = await tx
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
          eq(bookings.staffId, targetStaffId),
          inArray(bookings.status, ["PENDING", "CONFIRMED"]),
          sql`${bookings.id} <> ${booking.id}`,
        ),
      );

    const conflict = nearby.some((b) => {
      const s = b.startAt.getTime() - b.bufferBefore * 60_000;
      const e = b.endAt.getTime() + b.bufferAfter * 60_000;
      return occupiedStart < e && occupiedEnd > s;
    });
    if (conflict) return false;

    await tx
      .update(bookings)
      .set({
        staffId: targetStaffId,
        startAt: start,
        endAt: end,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, booking.id));

    return true;
  });

  if (!moved) return { ok: false, error: "Это время уже занято другим клиентом" };

  void notifyBookingRescheduled(booking.id);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/bookings");
  revalidatePath(`/${business.slug}`);
  return { ok: true };
}

export type ClientHistory = {
  totalVisits: number;
  completedVisits: number;
  cancelledVisits: number;
  noShowVisits: number;
  totalSpent: number;
  lastVisitAt: string | null;
};

export async function getClientHistoryAction(phone: string): Promise<ClientHistory> {
  const session = await requireUser();
  if (session.role !== "OWNER") {
    return { totalVisits: 0, completedVisits: 0, cancelledVisits: 0, noShowVisits: 0, totalSpent: 0, lastVisitAt: null };
  }

  const db = await getDb();
  const [business] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.ownerId, session.id))
    .limit(1);

  if (!business || !phone) {
    return { totalVisits: 0, completedVisits: 0, cancelledVisits: 0, noShowVisits: 0, totalSpent: 0, lastVisitAt: null };
  }

  const rows = await db
    .select({
      status: bookings.status,
      price: bookings.price,
      startAt: bookings.startAt,
    })
    .from(bookings)
    .where(and(eq(bookings.businessId, business.id), eq(bookings.clientPhone, phone)))
    .orderBy(desc(bookings.startAt));

  const totalVisits = rows.length;
  const completedVisits = rows.filter((r) => r.status === "COMPLETED").length;
  const cancelledVisits = rows.filter((r) => r.status === "CANCELLED").length;
  const noShowVisits = rows.filter((r) => r.status === "NO_SHOW").length;
  const totalSpent = rows
    .filter((r) => r.status === "COMPLETED")
    .reduce((sum, r) => sum + r.price, 0);
  const lastVisitAt = rows[0]?.startAt?.toISOString() ?? null;

  return {
    totalVisits,
    completedVisits,
    cancelledVisits,
    noShowVisits,
    totalSpent,
    lastVisitAt,
  };
}
