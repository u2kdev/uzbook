import { randomBytes } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  bookings,
  businesses,
  clients,
  services,
  staff,
  staffServices,
  type Business,
  type Service,
  type Staff,
} from "@/server/db/schema";
import { dateInZone } from "./time";
import { getAvailableSlots } from "./slots";
import {
  notifyBookingCancelled,
  notifyBookingRescheduled,
  notifyNewBooking,
} from "@/server/telegram/notify";

export type BookingFailure =
  | "business_not_found"
  | "service_not_found"
  | "staff_not_found"
  | "staff_does_not_provide_service"
  | "slot_unavailable"
  | "booking_not_found"
  | "booking_cancelled"
  | "invalid_input";

export type Result<T> = { ok: true; data: T } | { ok: false; error: BookingFailure };

export function newManageToken() {
  return randomBytes(24).toString("base64url");
}

export function normalizePhone(input: string) {
  const digits = input.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return `+${digits.slice(1).replace(/\D/g, "")}`;
  return digits;
}

export async function createBooking(input: {
  business: Business;
  serviceId: string;
  staffId: string;
  startAt: string | Date;
  name: string;
  phone: string;
  email?: string | null;
  note?: string | null;
  source?: "WEB" | "TELEGRAM" | "MANUAL";
}): Promise<Result<{ id: string; manageToken: string; startAt: Date; endAt: Date }>> {
  const db = await getDb();
  const start = new Date(input.startAt);
  if (Number.isNaN(start.getTime())) return { ok: false, error: "invalid_input" };

  const [service] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, input.serviceId), eq(services.businessId, input.business.id)))
    .limit(1);
  if (!service || !service.isActive) return { ok: false, error: "service_not_found" };

  const [member] = await db
    .select()
    .from(staff)
    .where(and(eq(staff.id, input.staffId), eq(staff.businessId, input.business.id)))
    .limit(1);
  if (!member || !member.isActive) return { ok: false, error: "staff_not_found" };

  const [link] = await db
    .select()
    .from(staffServices)
    .where(
      and(eq(staffServices.staffId, member.id), eq(staffServices.serviceId, service.id)),
    )
    .limit(1);
  if (!link) return { ok: false, error: "staff_does_not_provide_service" };

  const phone = normalizePhone(input.phone);
  if (!input.name.trim() || phone.length < 7) return { ok: false, error: "invalid_input" };

  const date = dateInZone(start, input.business.timezone);
  const slots = await getAvailableSlots({
    staffId: member.id,
    serviceId: service.id,
    date,
    timezone: input.business.timezone,
    settings: input.business.settings,
  });
  const slot = slots.find((s) => s.start === start.toISOString());
  if (!slot) return { ok: false, error: "slot_unavailable" };

  const end = new Date(start.getTime() + service.durationMin * 60_000);
  const manageToken = newManageToken();
  const occupiedStart = start.getTime() - service.bufferBeforeMin * 60_000;
  const occupiedEnd = end.getTime() + service.bufferAfterMin * 60_000;

  try {
    const created = await db.transaction(async (tx) => {
      // Serialize concurrent bookings for the same staff member.
      await tx.execute(sql`select id from staff where id = ${member.id} for update`);

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
            eq(bookings.staffId, member.id),
            inArray(bookings.status, ["PENDING", "CONFIRMED"]),
          ),
        );

      const conflict = nearby.some((b) => {
        const s = b.startAt.getTime() - b.bufferBefore * 60_000;
        const e = b.endAt.getTime() + b.bufferAfter * 60_000;
        return occupiedStart < e && occupiedEnd > s;
      });
      if (conflict) return null;

      const [client] = await tx
        .insert(clients)
        .values({
          businessId: input.business.id,
          name: input.name.trim().slice(0, 120),
          phone,
          email: input.email?.trim() || null,
        })
        .onConflictDoUpdate({
          target: [clients.businessId, clients.phone],
          set: { name: input.name.trim().slice(0, 120), email: input.email?.trim() || null },
        })
        .returning();

      const [row] = await tx
        .insert(bookings)
        .values({
          businessId: input.business.id,
          staffId: member.id,
          serviceId: service.id,
          clientId: client?.id ?? null,
          clientName: input.name.trim().slice(0, 120),
          clientPhone: phone,
          clientEmail: input.email?.trim() || null,
          startAt: start,
          endAt: end,
          status: input.business.settings.autoConfirm ? "CONFIRMED" : "PENDING",
          source: input.source ?? "WEB",
          price: service.price,
          durationMin: service.durationMin,
          note: input.note?.trim().slice(0, 500) || null,
          manageToken,
        })
        .returning();

      return row;
    });

    if (!created) return { ok: false, error: "slot_unavailable" };
    void notifyNewBooking(created.id);
    return {
      ok: true,
      data: { id: created.id, manageToken, startAt: start, endAt: end },
    };
  } catch (error) {
    console.error("createBooking failed", error);
    return { ok: false, error: "slot_unavailable" };
  }
}

export type PublicBooking = {
  id: string;
  startAt: Date;
  endAt: Date;
  status: string;
  price: number;
  durationMin: number;
  clientName: string;
  clientPhone: string;
  note: string | null;
  manageToken: string;
  service: Pick<Service, "id" | "name" | "durationMin" | "price">;
  staff: Pick<Staff, "id" | "name" | "photoUrl" | "title">;
  business: Pick<
    Business,
    "id" | "name" | "slug" | "timezone" | "currency" | "phone" | "address" | "city" | "logoUrl"
  >;
};

export async function getBookingByToken(token: string): Promise<PublicBooking | null> {
  if (!token || token.length < 10) return null;
  const db = await getDb();
  const [row] = await db
    .select({
      booking: bookings,
      service: services,
      staff,
      business: businesses,
    })
    .from(bookings)
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .innerJoin(staff, eq(bookings.staffId, staff.id))
    .innerJoin(businesses, eq(bookings.businessId, businesses.id))
    .where(eq(bookings.manageToken, token))
    .limit(1);

  if (!row) return null;

  return {
    id: row.booking.id,
    startAt: row.booking.startAt,
    endAt: row.booking.endAt,
    status: row.booking.status,
    price: row.booking.price,
    durationMin: row.booking.durationMin,
    clientName: row.booking.clientName,
    clientPhone: row.booking.clientPhone,
    note: row.booking.note,
    manageToken: row.booking.manageToken,
    service: {
      id: row.service.id,
      name: row.service.name,
      durationMin: row.service.durationMin,
      price: row.service.price,
    },
    staff: {
      id: row.staff.id,
      name: row.staff.name,
      photoUrl: row.staff.photoUrl,
      title: row.staff.title,
    },
    business: {
      id: row.business.id,
      name: row.business.name,
      slug: row.business.slug,
      timezone: row.business.timezone,
      currency: row.business.currency,
      phone: row.business.phone,
      address: row.business.address,
      city: row.business.city,
      logoUrl: row.business.logoUrl,
    },
  };
}

export async function cancelBooking(
  token: string,
  reason?: string,
): Promise<Result<{ id: string }>> {
  const db = await getDb();
  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.manageToken, token))
    .limit(1);
  if (!booking) return { ok: false, error: "booking_not_found" };
  if (booking.status === "CANCELLED") return { ok: false, error: "booking_cancelled" };

  await db
    .update(bookings)
    .set({
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelReason: reason?.slice(0, 300) ?? null,
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, booking.id));

  void notifyBookingCancelled(booking.id);
  return { ok: true, data: { id: booking.id } };
}

export async function rescheduleBooking(
  token: string,
  newStartAt: string | Date,
): Promise<Result<{ startAt: Date; endAt: Date }>> {
  const db = await getDb();
  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.manageToken, token))
    .limit(1);
  if (!booking) return { ok: false, error: "booking_not_found" };
  if (booking.status === "CANCELLED") return { ok: false, error: "booking_cancelled" };

  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, booking.businessId))
    .limit(1);
  if (!business) return { ok: false, error: "business_not_found" };

  const start = new Date(newStartAt);
  if (Number.isNaN(start.getTime())) return { ok: false, error: "invalid_input" };

  const [service] = await db
    .select()
    .from(services)
    .where(eq(services.id, booking.serviceId))
    .limit(1);
  if (!service) return { ok: false, error: "service_not_found" };

  const date = dateInZone(start, business.timezone);
  const slots = await getAvailableSlots({
    staffId: booking.staffId,
    serviceId: booking.serviceId,
    date,
    timezone: business.timezone,
    settings: business.settings,
    excludeBookingId: booking.id,
  });
  if (!slots.some((s) => s.start === start.toISOString())) {
    return { ok: false, error: "slot_unavailable" };
  }

  const end = new Date(start.getTime() + service.durationMin * 60_000);
  const occupiedStart = start.getTime() - service.bufferBeforeMin * 60_000;
  const occupiedEnd = end.getTime() + service.bufferAfterMin * 60_000;

  const moved = await db.transaction(async (tx) => {
    await tx.execute(sql`select id from staff where id = ${booking.staffId} for update`);
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
          eq(bookings.staffId, booking.staffId),
          inArray(bookings.status, ["PENDING", "CONFIRMED"]),
          sql`${bookings.id} <> ${booking.id}`,
        ),
      );
    const conflict = nearby.some((b) => {
      const s = b.startAt.getTime() - b.bufferBefore * 60_000;
      const e = b.endAt.getTime() + b.bufferAfter * 60_000;
      return occupiedStart < e && occupiedEnd > s;
    });
    if (conflict) return null;

    await tx
      .update(bookings)
      .set({ startAt: start, endAt: end, updatedAt: new Date() })
      .where(eq(bookings.id, booking.id));
    return true;
  });

  if (!moved) return { ok: false, error: "slot_unavailable" };
  void notifyBookingRescheduled(booking.id);
  return { ok: true, data: { startAt: start, endAt: end } };
}
