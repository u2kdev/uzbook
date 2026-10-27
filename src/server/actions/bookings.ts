"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { bookings, businesses } from "@/server/db/schema";
import { getSession, requireUser } from "@/server/auth/session";
import { createBooking } from "@/server/booking/service";

export type StatusActionResult = { ok: boolean; error?: string };

async function ownsBooking(bookingId: string) {
  const session = await getSession();
  if (!session) return false;
  const db = await getDb();
  const [row] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .innerJoin(businesses, eq(bookings.businessId, businesses.id))
    .where(and(eq(bookings.id, bookingId), eq(businesses.ownerId, session.id)))
    .limit(1);
  return Boolean(row);
}

export async function setBookingStatus(
  bookingId: string,
  status: "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW",
): Promise<StatusActionResult> {
  if (!(await ownsBooking(bookingId))) return { ok: false, error: "Нет доступа" };
  const db = await getDb();
  await db
    .update(bookings)
    .set({
      status,
      updatedAt: new Date(),
      ...(status === "CANCELLED" ? { cancelledAt: new Date(), cancelReason: "Отменено владельцем" } : {}),
    })
    .where(eq(bookings.id, bookingId));
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
