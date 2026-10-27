"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db";
import { businesses, pageSections } from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { writeBlockedReason } from "@/server/limits";

export type SectionState = { ok?: boolean; error?: string; sectionId?: string } | null;

const sectionConfigSchema = z.object({
  type: z.enum([
    "hero",
    "staff",
    "services",
    "contacts",
    "reviews",
    "promotions",
    "faq",
    "gallery",
    "vacancies",
    "custom_html",
  ]),
  enabled: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  config: z.record(z.string(), z.unknown()).default({}),
});

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

function boolField(value: FormDataEntryValue | null, fallback = true) {
  if (value === null) return fallback;
  return value === "true" || value === "on" || value === "1";
}

function refresh(slug: string) {
  revalidatePath("/dashboard/profile");
  revalidatePath(`/${slug}`);
}

export async function createSectionAction(
  _prev: SectionState,
  formData: FormData,
): Promise<SectionState> {
  const { business, db } = await myBusiness();
  if (!business) return { error: "Сначала создайте бизнес" };

  const blocked = writeBlockedReason(business);
  if (blocked) return { error: blocked };

  const parsed = sectionConfigSchema.safeParse({
    type: String(formData.get("type") ?? ""),
    enabled: boolField(formData.get("enabled")),
    sortOrder: Number(String(formData.get("sortOrder") ?? "0")),
    config: JSON.parse(String(formData.get("config") ?? "{}")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const [section] = await db
    .insert(pageSections)
    .values({
      businessId: business.id,
      type: parsed.data.type,
      enabled: parsed.data.enabled,
      sortOrder: parsed.data.sortOrder,
      config: parsed.data.config,
    })
    .returning({ id: pageSections.id });

  refresh(business.slug);
  return { ok: true, sectionId: section.id };
}

export async function updateSectionAction(
  _prev: SectionState,
  formData: FormData,
): Promise<SectionState> {
  const { business, db } = await myBusiness();
  if (!business) return { error: "Нет доступа" };

  const blocked = writeBlockedReason(business);
  if (blocked) return { error: blocked };

  const sectionId = String(formData.get("sectionId") ?? "");
  if (!sectionId) return { error: "ID секции не указан" };

  const parsed = sectionConfigSchema.safeParse({
    type: String(formData.get("type") ?? ""),
    enabled: boolField(formData.get("enabled")),
    sortOrder: Number(String(formData.get("sortOrder") ?? "0")),
    config: JSON.parse(String(formData.get("config") ?? "{}")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  await db
    .update(pageSections)
    .set({
      type: parsed.data.type,
      enabled: parsed.data.enabled,
      sortOrder: parsed.data.sortOrder,
      config: parsed.data.config,
      updatedAt: new Date(),
    })
    .where(and(eq(pageSections.id, sectionId), eq(pageSections.businessId, business.id)));

  refresh(business.slug);
  return { ok: true };
}

export async function deleteSectionAction(
  _prev: SectionState,
  formData: FormData,
): Promise<SectionState> {
  const sectionId = String(formData.get("sectionId") ?? "");
  const { business, db } = await myBusiness();
  if (!business) return { error: "Нет доступа" };

  const blocked = writeBlockedReason(business);
  if (blocked) return { error: blocked };

  await db
    .delete(pageSections)
    .where(and(eq(pageSections.id, sectionId), eq(pageSections.businessId, business.id)));

  refresh(business.slug);
  return { ok: true };
}

export async function reorderSectionsAction(
  _prev: SectionState,
  formData: FormData,
): Promise<SectionState> {
  const { business, db } = await myBusiness();
  if (!business) return { error: "Нет доступа" };

  const blocked = writeBlockedReason(business);
  if (blocked) return { error: blocked };

  const orderJson = String(formData.get("order") ?? "[]");
  let order: { id: string; sortOrder: number }[];
  try {
    order = JSON.parse(orderJson);
  } catch {
    return { error: "Неверный формат данных" };
  }

  await db.transaction(async (tx) => {
    for (const item of order) {
      await tx
        .update(pageSections)
        .set({ sortOrder: item.sortOrder, updatedAt: new Date() })
        .where(and(eq(pageSections.id, item.id), eq(pageSections.businessId, business.id)));
    }
  });

  refresh(business.slug);
  return { ok: true };
}

export async function getSections() {
  const { business, db } = await myBusiness();
  if (!business) return [];

  return db
    .select()
    .from(pageSections)
    .where(eq(pageSections.businessId, business.id))
    .orderBy(pageSections.sortOrder);
}

export async function getPublicSections(businessId: string) {
  const db = await getDb();
  return db
    .select()
    .from(pageSections)
    .where(and(eq(pageSections.businessId, businessId), eq(pageSections.enabled, true)))
    .orderBy(pageSections.sortOrder);
}