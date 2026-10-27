"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db";
import { businesses, services, staff, staffServices, workingHours } from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { serviceLimitError, staffLimitError, writeBlockedReason } from "@/server/limits";

export type ActionState = { ok?: boolean; error?: string; field?: string } | null;

async function myBusiness() {
  const session = await requireUser();
  if (session.role !== "OWNER") throw new Error("Только владелец может менять настройки");
  const db = await getDb();
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.ownerId, session.id))
    .limit(1);
  return { business, db };
}

function num(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

const serviceSchema = z.object({
  name: z.string().min(2, "Название минимум 2 символа").max(100),
  description: z.string().max(500).optional(),
  category: z.string().max(60).optional(),
  durationMin: z.number().int().min(5, "Минимум 5 минут").max(720, "Максимум 12 часов"),
  bufferBeforeMin: z.number().int().min(0).max(120),
  bufferAfterMin: z.number().int().min(0).max(120),
  price: z.number().int().min(0).max(1_000_000_000),
});

function parseService(formData: FormData) {
  return serviceSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || undefined,
    category: String(formData.get("category") ?? "").trim() || undefined,
    durationMin: Math.round(num(formData.get("durationMin"), 60)),
    bufferBeforeMin: Math.round(num(formData.get("bufferBeforeMin"), 0)),
    bufferAfterMin: Math.round(num(formData.get("bufferAfterMin"), 10)),
    price: Math.round(num(formData.get("price"), 0)),
  });
}

export async function createServiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { business, db } = await myBusiness();
  if (!business) return { error: "Сначала создайте бизнес" };

  const parsed = parseService(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const limitError = await serviceLimitError(business);
  if (limitError) return { error: limitError };

  const existing = await db
    .select({ id: services.id })
    .from(services)
    .where(eq(services.businessId, business.id));

  await db.insert(services).values({
    businessId: business.id,
    ...parsed.data,
    sortOrder: existing.length,
  });

  revalidatePath("/dashboard/services");
  revalidatePath(`/${business.slug}`);
  return { ok: true };
}

export async function updateServiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { business, db } = await myBusiness();
  if (!business) return { error: "Сначала создайте бизнес" };

  const blocked = writeBlockedReason(business);
  if (blocked) return { error: blocked };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Услуга не найдена" };

  const parsed = parseService(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await db
    .update(services)
    .set({ ...parsed.data, ...(formData.get("isActive") ? { isActive: true } : {}) })
    .where(and(eq(services.id, id), eq(services.businessId, business.id)));

  revalidatePath("/dashboard/services");
  revalidatePath(`/${business.slug}`);
  return { ok: true };
}

export async function deleteServiceAction(id: string): Promise<ActionState> {
  const { business, db } = await myBusiness();
  if (!business) return { error: "Сначала создайте бизнес" };

  const blocked = writeBlockedReason(business);
  if (blocked) return { error: blocked };

  try {
    await db
      .delete(services)
      .where(and(eq(services.id, id), eq(services.businessId, business.id)));
    revalidatePath("/dashboard/services");
    return { ok: true };
  } catch {
    return { error: "По этой услуге уже есть записи — отключите её вместо удаления." };
  }
}

export async function toggleServiceAction(id: string, isActive: boolean): Promise<ActionState> {
  const { business, db } = await myBusiness();
  if (!business) return { error: "Нет доступа" };

  const blocked = writeBlockedReason(business);
  if (blocked) return { error: blocked };

  await db
    .update(services)
    .set({ isActive })
    .where(and(eq(services.id, id), eq(services.businessId, business.id)));
  revalidatePath("/dashboard/services");
  revalidatePath(`/${business.slug}`);
  return { ok: true };
}

/* ------------------------------- staff ------------------------------- */

export async function createStaffAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { business, db } = await myBusiness();
  if (!business) return { error: "Сначала создайте бизнес" };

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Имя минимум 2 символа" };

  const limitError = await staffLimitError(business);
  if (limitError) return { error: limitError };

  const title = String(formData.get("title") ?? "").trim() || null;
  const color = String(formData.get("color") ?? "#6e56f8");
  const serviceIds = formData.getAll("serviceIds").map(String).filter(Boolean);
  const bio = String(formData.get("bio") ?? "").trim() || null;

  const [member] = await db
    .insert(staff)
    .values({ businessId: business.id, name, title, color, bio })
    .returning();

  if (serviceIds.length > 0) {
    await db
      .insert(staffServices)
      .values(serviceIds.map((serviceId) => ({ staffId: member.id, serviceId })))
      .onConflictDoNothing();
  }

  // Sensible default week: Mon–Sat 10:00–20:00
  await db.insert(workingHours).values(
    [1, 2, 3, 4, 5, 6].map((weekday) => ({
      staffId: member.id,
      weekday,
      startMinute: 10 * 60,
      endMinute: 20 * 60,
    })),
  );

  revalidatePath("/dashboard/staff");
  revalidatePath(`/${business.slug}`);
  return { ok: true };
}

export async function updateStaffAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { business, db } = await myBusiness();
  if (!business) return { error: "Сначала создайте бизнес" };

  const blocked = writeBlockedReason(business);
  if (blocked) return { error: blocked };

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || name.length < 2) return { error: "Проверьте имя мастера" };

  const [member] = await db
    .select()
    .from(staff)
    .where(and(eq(staff.id, id), eq(staff.businessId, business.id)))
    .limit(1);
  if (!member) return { error: "Мастер не найден" };

  await db
    .update(staff)
    .set({
      name,
      title: String(formData.get("title") ?? "").trim() || null,
      bio: String(formData.get("bio") ?? "").trim() || null,
      color: String(formData.get("color") ?? member.color),
      isActive: formData.get("isActive") !== null,
    })
    .where(eq(staff.id, member.id));

  const serviceIds = formData.getAll("serviceIds").map(String).filter(Boolean);
  await db.delete(staffServices).where(eq(staffServices.staffId, member.id));
  if (serviceIds.length > 0) {
    await db
      .insert(staffServices)
      .values(serviceIds.map((serviceId) => ({ staffId: member.id, serviceId })))
      .onConflictDoNothing();
  }

  revalidatePath("/dashboard/staff");
  revalidatePath(`/dashboard/staff/${member.id}`);
  revalidatePath(`/${business.slug}`);
  return { ok: true };
}

export async function deleteStaffAction(id: string): Promise<ActionState> {
  const { business, db } = await myBusiness();
  if (!business) return { error: "Нет доступа" };

  const blocked = writeBlockedReason(business);
  if (blocked) return { error: blocked };

  await db.delete(staff).where(and(eq(staff.id, id), eq(staff.businessId, business.id)));
  revalidatePath("/dashboard/staff");
  return { ok: true };
}

const scheduleSchema = z.array(
  z.object({
    weekday: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1440),
    endMinute: z.number().int().min(0).max(1440),
  }),
);

export async function saveScheduleAction(
  staffId: string,
  scheduleJson: string,
): Promise<ActionState> {
  const { business, db } = await myBusiness();
  if (!business) return { error: "Нет доступа" };

  const blocked = writeBlockedReason(business);
  if (blocked) return { error: blocked };

  const [member] = await db
    .select()
    .from(staff)
    .where(and(eq(staff.id, staffId), eq(staff.businessId, business.id)))
    .limit(1);
  if (!member) return { error: "Мастер не найден" };

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(scheduleJson);
  } catch {
    return { error: "Некорректное расписание" };
  }
  const parsed = scheduleSchema.safeParse(parsedJson);
  if (!parsed.success) return { error: "Проверьте время в расписании" };

  for (const row of parsed.data) {
    if (row.endMinute <= row.startMinute) {
      return { error: "Конец смены должен быть позже начала" };
    }
  }

  await db.transaction(async (tx) => {
    await tx.delete(workingHours).where(eq(workingHours.staffId, member.id));
    if (parsed.data.length > 0) {
      await tx
        .insert(workingHours)
        .values(parsed.data.map((row) => ({ staffId: member.id, ...row })));
    }
  });

  revalidatePath(`/dashboard/staff/${member.id}`);
  revalidatePath(`/${business.slug}`);
  return { ok: true };
}

export async function bulkAssignServicesAction(
  staffId: string,
  serviceIds: string[],
): Promise<ActionState> {
  const { business, db } = await myBusiness();
  if (!business) return { error: "Нет доступа" };

  const blocked = writeBlockedReason(business);
  if (blocked) return { error: blocked };

  const [member] = await db
    .select()
    .from(staff)
    .where(and(eq(staff.id, staffId), eq(staff.businessId, business.id)))
    .limit(1);
  if (!member) return { error: "Мастер не найден" };

  const valid = serviceIds.length
    ? await db
        .select({ id: services.id })
        .from(services)
        .where(and(eq(services.businessId, business.id), inArray(services.id, serviceIds)))
    : [];

  await db.delete(staffServices).where(eq(staffServices.staffId, member.id));
  if (valid.length > 0) {
    await db
      .insert(staffServices)
      .values(valid.map((row) => ({ staffId: member.id, serviceId: row.id })))
      .onConflictDoNothing();
  }
  revalidatePath(`/dashboard/staff/${member.id}`);
  return { ok: true };
}
