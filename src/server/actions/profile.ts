"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db";
import { businesses, subscriptions, type BusinessSettings } from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { isValidSlug, slugify } from "@/lib/slug";
import { planById, type PlanId } from "@/lib/plans";

export type ProfileState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
} | null;

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

function text(value: FormDataEntryValue | null, max = 400) {
  return String(value ?? "").trim().slice(0, max) || null;
}

const urlField = z
  .string()
  .trim()
  .max(400)
  .refine(
    (value) => value === "" || /^https?:\/\/.+/i.test(value) || value.startsWith("/"),
    "Ссылка должна начинаться с https://",
  )
  .optional();

const profileSchema = z.object({
  name: z.string().trim().min(2, "Название минимум 2 символа").max(80),
  slug: z.string().trim().min(2).max(48),
  category: z.string().trim().min(1).max(40),
  tagline: z.string().trim().max(120).optional(),
  description: z.string().trim().max(1200).optional(),
  city: z.string().trim().max(80).optional(),
  address: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(40).optional(),
  instagram: z.string().trim().max(60).optional(),
  website: urlField,
  slotStepMin: z.number().int().min(5).max(60),
  leadTimeMin: z.number().int().min(0).max(1440),
  maxAdvanceDays: z.number().int().min(1).max(365),
  cancellationHours: z.number().int().min(0).max(720),
  autoConfirm: z.boolean(),
  showPrices: z.boolean(),
  requireEmail: z.boolean(),
});

export async function updateProfileAction(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const { business, db } = await myBusiness();
  if (!business) return { error: "Сначала создайте бизнес" };

  const parsed = profileSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    slug: slugify(String(formData.get("slug") ?? "")),
    category: String(formData.get("category") ?? "beauty"),
    tagline: text(formData.get("tagline"), 120) ?? "",
    description: text(formData.get("description"), 1200) ?? "",
    city: text(formData.get("city"), 80) ?? "",
    address: text(formData.get("address"), 160) ?? "",
    phone: text(formData.get("phone"), 40) ?? "",
    instagram: text(formData.get("instagram"), 60)?.replace(/^@/, "") ?? "",
    website: text(formData.get("website"), 400) ?? "",
    slotStepMin: Math.round(num(formData.get("slotStepMin"), 15)),
    leadTimeMin: Math.round(num(formData.get("leadTimeMin"), 30)),
    maxAdvanceDays: Math.round(num(formData.get("maxAdvanceDays"), 60)),
    cancellationHours: Math.round(num(formData.get("cancellationHours"), 3)),
    autoConfirm: formData.get("autoConfirm") !== null,
    showPrices: formData.get("showPrices") !== null,
    requireEmail: formData.get("requireEmail") !== null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  if (!isValidSlug(parsed.data.slug)) {
    return {
      fieldErrors: { slug: "Латиница, цифры и дефис. Этот адрес занят или зарезервирован." },
    };
  }

  const [taken] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(and(eq(businesses.slug, parsed.data.slug), ne(businesses.id, business.id)))
    .limit(1);
  if (taken) return { fieldErrors: { slug: "Этот адрес уже занят. Выберите другой." } };

  const settings: BusinessSettings = {
    ...business.settings,
    slotStepMin: parsed.data.slotStepMin,
    leadTimeMin: parsed.data.leadTimeMin,
    maxAdvanceDays: parsed.data.maxAdvanceDays,
    cancellationHours: parsed.data.cancellationHours,
    autoConfirm: parsed.data.autoConfirm,
    showPrices: parsed.data.showPrices,
    requireEmail: parsed.data.requireEmail,
  };

  const emptyToNull = (value: string) => (value.trim() === "" ? null : value.trim());

  await db
    .update(businesses)
    .set({
      name: parsed.data.name,
      slug: parsed.data.slug,
      category: parsed.data.category,
      tagline: emptyToNull(parsed.data.tagline ?? ""),
      description: emptyToNull(parsed.data.description ?? ""),
      city: emptyToNull(parsed.data.city ?? ""),
      address: emptyToNull(parsed.data.address ?? ""),
      phone: emptyToNull(parsed.data.phone ?? ""),
      instagram: emptyToNull(parsed.data.instagram ?? ""),
      website: emptyToNull(parsed.data.website ?? ""),
      settings,
    })
    .where(eq(businesses.id, business.id));

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/billing");
  revalidatePath(`/${business.slug}`);
  revalidatePath(`/${parsed.data.slug}`);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Billing / plan requests                                             */
/* ------------------------------------------------------------------ */

export type BillingState = { ok?: boolean; error?: string } | null;

export async function requestPlanAction(
  _prev: BillingState,
  formData: FormData,
): Promise<BillingState> {
  const { business, db } = await myBusiness();
  if (!business) return { error: "Сначала создайте бизнес" };

  const plan = String(formData.get("plan") ?? "") as PlanId;
  if (!["START", "PRO", "BUSINESS"].includes(plan)) {
    return { error: "Выберите тариф" };
  }

  const current = planById(plan);

  await db.transaction(async (tx) => {
    await tx
      .update(subscriptions)
      .set({ status: "CANCELLED" })
      .where(
        and(eq(subscriptions.businessId, business.id), eq(subscriptions.status, "PENDING")),
      );

    await tx.insert(subscriptions).values({
      businessId: business.id,
      plan,
      status: "PENDING",
      provider: "MANUAL",
      amount: current.priceUzs,
      currency: business.currency,
      note: "Заявка на подключение тарифа из кабинета",
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
  });

  revalidatePath("/dashboard/billing");
  revalidatePath("/admin");
  return { ok: true };
}

export async function cancelPlanRequestAction(subscriptionId: string): Promise<BillingState> {
  const { business, db } = await myBusiness();
  if (!business) return { error: "Нет доступа" };

  await db
    .update(subscriptions)
    .set({ status: "CANCELLED" })
    .where(
      and(
        eq(subscriptions.id, subscriptionId),
        eq(subscriptions.businessId, business.id),
        eq(subscriptions.status, "PENDING"),
      ),
    );

  revalidatePath("/dashboard/billing");
  return { ok: true };
}
