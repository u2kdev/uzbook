"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db";
import { businesses, pageSections } from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { writeBlockedReason } from "@/server/limits";
import { sanitizeHtml } from "@/lib/sanitize-html";

export type SectionState = {
  ok?: boolean;
  error?: string;
  sectionId?: string;
  sections?: typeof pageSections.$inferSelect[];
} | null;

const MAX_CONFIG_JSON_BYTES = 64 * 1024;

const heroConfigSchema = z
  .object({
    showNearestSlot: z.boolean().optional(),
    showPhoneButton: z.boolean().optional(),
    ctaText: z.string().max(120).optional(),
    badgeText: z.string().max(120).optional(),
    align: z.enum(["left", "center"]).optional(),
  })
  .passthrough();

const servicesConfigSchema = z
  .object({
    title: z.string().max(120).optional(),
    subtitle: z.string().max(160).optional(),
    groupByCategory: z.boolean().optional(),
    showPrices: z.boolean().optional(),
    showDuration: z.boolean().optional(),
  })
  .passthrough();

const staffConfigSchema = z
  .object({
    title: z.string().max(120).optional(),
    subtitle: z.string().max(160).optional(),
    showBio: z.boolean().optional(),
    showNextSlots: z.boolean().optional(),
    columns: z.coerce.number().int().min(1).max(4).optional(),
  })
  .passthrough();

const contactsConfigSchema = z
  .object({
    title: z.string().max(120).optional(),
    showAddress: z.boolean().optional(),
    showPhone: z.boolean().optional(),
    showInstagram: z.boolean().optional(),
    showWebsite: z.boolean().optional(),
  })
  .passthrough();

const galleryConfigSchema = z
  .object({
    title: z.string().max(120).optional(),
    subtitle: z.string().max(160).optional(),
    items: z.array(z.record(z.string(), z.unknown())).max(100).optional(),
  })
  .passthrough();

const promotionsConfigSchema = z
  .object({
    title: z.string().max(120).optional(),
    subtitle: z.string().max(160).optional(),
    items: z
      .array(
        z
          .object({
            title: z.string().max(200).optional().default(""),
            serviceCategory: z.string().max(120).optional().default(""),
            validUntil: z.string().max(40).optional().default(""),
            description: z.string().max(1000).optional().default(""),
          })
          .passthrough(),
      )
      .max(50)
      .optional(),
  })
  .passthrough();

const reviewsConfigSchema = z
  .object({
    title: z.string().max(120).optional(),
    subtitle: z.string().max(160).optional(),
    items: z
      .array(
        z
          .object({
            name: z.string().max(120).optional().default(""),
            rating: z.coerce.number().int().min(1).max(5).optional().default(5),
            date: z.string().max(40).optional().default(""),
            text: z.string().max(1500).optional().default(""),
          })
          .passthrough(),
      )
      .max(100)
      .optional(),
  })
  .passthrough();

const faqConfigSchema = z
  .object({
    title: z.string().max(120).optional(),
    subtitle: z.string().max(160).optional(),
    items: z
      .array(
        z
          .object({
            question: z.string().max(300).optional().default(""),
            answer: z.string().max(2000).optional().default(""),
          })
          .passthrough(),
      )
      .max(100)
      .optional(),
  })
  .passthrough();

const vacanciesConfigSchema = z
  .object({
    title: z.string().max(120).optional(),
    subtitle: z.string().max(160).optional(),
    items: z
      .array(
        z
          .object({
            title: z.string().max(200).optional().default(""),
            requirements: z.string().max(600).optional().default(""),
            description: z.string().max(1500).optional().default(""),
          })
          .passthrough(),
      )
      .max(50)
      .optional(),
  })
  .passthrough();

const customHtmlConfigSchema = z
  .object({
    html: z.string().max(30000).optional().default(""),
  })
  .passthrough();

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
  sortOrder: z.number().int().min(0).max(1000).default(0),
  config: z.record(z.string(), z.unknown()).default({}),
});

function validateAndSanitizeSectionConfig(
  type: z.infer<typeof sectionConfigSchema>["type"],
  config: Record<string, unknown>,
): { ok: true; config: Record<string, unknown> } | { ok: false; error: string } {
  const schemaByType: Record<z.infer<typeof sectionConfigSchema>["type"], z.ZodTypeAny> = {
    hero: heroConfigSchema,
    services: servicesConfigSchema,
    staff: staffConfigSchema,
    contacts: contactsConfigSchema,
    gallery: galleryConfigSchema,
    promotions: promotionsConfigSchema,
    reviews: reviewsConfigSchema,
    faq: faqConfigSchema,
    vacancies: vacanciesConfigSchema,
    custom_html: customHtmlConfigSchema,
  };

  const parsed = schemaByType[type].safeParse(config);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message || "Некорректные параметры настроек секции",
    };
  }

  const data = parsed.data as Record<string, unknown>;
  if (type === "custom_html") {
    return {
      ok: true,
      config: {
        ...data,
        html: sanitizeHtml(data.html),
      },
    };
  }
  return { ok: true, config: data };
}

function sanitizeSectionConfig(
  type: z.infer<typeof sectionConfigSchema>["type"],
  config: Record<string, unknown>,
): Record<string, unknown> {
  const res = validateAndSanitizeSectionConfig(type, config);
  return res.ok ? res.config : config;
}

function parseConfigJson(raw: FormDataEntryValue | null): Record<string, unknown> | null {
  try {
    const str = String(raw ?? "{}");
    if (Buffer.byteLength(str, "utf8") > MAX_CONFIG_JSON_BYTES) return null;
    const parsed = JSON.parse(str);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function myBusiness() {
  const session = await requireUser();
  if (session.role !== "OWNER" && session.role !== "ADMIN") {
    throw new Error("Только владелец может менять настройки");
  }
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

  const rawConfig = parseConfigJson(formData.get("config"));
  if (!rawConfig) {
    return { error: "Неверный формат настроек секции" };
  }

  const parsed = sectionConfigSchema.safeParse({
    type: String(formData.get("type") ?? ""),
    enabled: boolField(formData.get("enabled")),
    sortOrder: Number(String(formData.get("sortOrder") ?? "0")),
    config: rawConfig,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const validated = validateAndSanitizeSectionConfig(parsed.data.type, parsed.data.config);
  if (!validated.ok) {
    return { error: validated.error };
  }
  const safeConfig = validated.config;

  const [section] = await db
    .insert(pageSections)
    .values({
      businessId: business.id,
      type: parsed.data.type,
      enabled: parsed.data.enabled,
      sortOrder: parsed.data.sortOrder,
      config: safeConfig,
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

  const rawConfig = parseConfigJson(formData.get("config"));
  if (!rawConfig) {
    return { error: "Неверный формат настроек секции" };
  }

  const parsed = sectionConfigSchema.safeParse({
    type: String(formData.get("type") ?? ""),
    enabled: boolField(formData.get("enabled")),
    sortOrder: Number(String(formData.get("sortOrder") ?? "0")),
    config: rawConfig,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const validated = validateAndSanitizeSectionConfig(parsed.data.type, parsed.data.config);
  if (!validated.ok) {
    return { error: validated.error };
  }
  const safeConfig = validated.config;

  await db
    .update(pageSections)
    .set({
      type: parsed.data.type,
      enabled: parsed.data.enabled,
      sortOrder: parsed.data.sortOrder,
      config: safeConfig,
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

const PRESET_LAYOUTS: Record<
  string,
  Array<{
    type: z.infer<typeof sectionConfigSchema>["type"];
    enabled: boolean;
    defaultConfig: Record<string, unknown>;
  }>
> = {
  salon_standard: [
    {
      type: "hero",
      enabled: true,
      defaultConfig: { showNearestSlot: true, showPhoneButton: true, ctaText: "Записаться онлайн", align: "left" },
    },
    {
      type: "services",
      enabled: true,
      defaultConfig: { title: "Услуги и цены", subtitle: "Прайс", groupByCategory: true, showPrices: true, showDuration: true },
    },
    {
      type: "staff",
      enabled: true,
      defaultConfig: { title: "Мастера", subtitle: "Выберите специалиста для записи", showBio: true, showNextSlots: true, columns: 3 },
    },
    {
      type: "gallery",
      enabled: true,
      defaultConfig: { title: "Наши работы", subtitle: "До / После", items: [] },
    },
    {
      type: "reviews",
      enabled: true,
      defaultConfig: { title: "Отзывы", subtitle: "Что говорят клиенты", items: [] },
    },
    {
      type: "contacts",
      enabled: true,
      defaultConfig: { title: "Контакты", showAddress: true, showPhone: true, showInstagram: true, showWebsite: true },
    },
  ],
  quick_booking: [
    {
      type: "hero",
      enabled: true,
      defaultConfig: { showNearestSlot: true, showPhoneButton: true, ctaText: "Выбрать время", align: "left" },
    },
    {
      type: "services",
      enabled: true,
      defaultConfig: { title: "Прайс-лист", subtitle: "Услуги", groupByCategory: true, showPrices: true, showDuration: true },
    },
    {
      type: "staff",
      enabled: true,
      defaultConfig: { title: "Специалисты", subtitle: "Свободные окна на сегодня и завтра", showBio: false, showNextSlots: true, columns: 2 },
    },
    {
      type: "contacts",
      enabled: true,
      defaultConfig: { title: "Как нас найти", showAddress: true, showPhone: true, showInstagram: true, showWebsite: false },
    },
  ],
  portfolio_focus: [
    {
      type: "hero",
      enabled: true,
      defaultConfig: { showNearestSlot: true, showPhoneButton: true, ctaText: "Записаться к мастеру", align: "center" },
    },
    {
      type: "gallery",
      enabled: true,
      defaultConfig: { title: "Портфолио работ", subtitle: "Примеры До / После", items: [] },
    },
    {
      type: "services",
      enabled: true,
      defaultConfig: { title: "Услуги и стоимость", subtitle: "Прайс", groupByCategory: true, showPrices: true, showDuration: true },
    },
    {
      type: "staff",
      enabled: true,
      defaultConfig: { title: "О мастере", subtitle: "Ваш специалист", showBio: true, showNextSlots: true, columns: 2 },
    },
    {
      type: "faq",
      enabled: true,
      defaultConfig: { title: "Частые вопросы", items: [] },
    },
    {
      type: "contacts",
      enabled: true,
      defaultConfig: { title: "Контакты", showAddress: true, showPhone: true, showInstagram: true, showWebsite: true },
    },
  ],
  full_landing: [
    {
      type: "hero",
      enabled: true,
      defaultConfig: { showNearestSlot: true, showPhoneButton: true, ctaText: "Записаться онлайн", align: "left" },
    },
    {
      type: "promotions",
      enabled: true,
      defaultConfig: { title: "Акции", subtitle: "Специальные предложения", items: [] },
    },
    {
      type: "services",
      enabled: true,
      defaultConfig: { title: "Услуги", subtitle: "Прайс", groupByCategory: true, showPrices: true, showDuration: true },
    },
    {
      type: "staff",
      enabled: true,
      defaultConfig: { title: "Команда мастеров", subtitle: "Нажмите на мастера, чтобы выбрать время", showBio: true, showNextSlots: true, columns: 3 },
    },
    {
      type: "gallery",
      enabled: true,
      defaultConfig: { title: "Наши работы", subtitle: "До / После", items: [] },
    },
    {
      type: "reviews",
      enabled: true,
      defaultConfig: { title: "Отзывы клиентов", subtitle: "Нам доверяют", items: [] },
    },
    {
      type: "faq",
      enabled: true,
      defaultConfig: { title: "Ответы на вопросы", items: [] },
    },
    {
      type: "contacts",
      enabled: true,
      defaultConfig: { title: "Контакты", showAddress: true, showPhone: true, showInstagram: true, showWebsite: true },
    },
  ],
};

export async function applyPagePresetAction(presetId: string): Promise<SectionState> {
  const { business, db } = await myBusiness();
  if (!business) return { error: "Сначала создайте бизнес" };

  const blocked = writeBlockedReason(business);
  if (blocked) return { error: blocked };

  const preset = PRESET_LAYOUTS[presetId];
  if (!preset) return { error: "Шаблон не найден" };

  const existing = await db
    .select()
    .from(pageSections)
    .where(eq(pageSections.businessId, business.id));

  const presetTypes = new Set(preset.map((item) => item.type));

  await db.transaction(async (tx) => {
    for (const [index, item] of preset.entries()) {
      const found = existing.find((s) => s.type === item.type);
      if (found) {
        const mergedConfig = {
          ...item.defaultConfig,
          ...(found.config ?? {}),
          ...(item.defaultConfig.ctaText ? { ctaText: item.defaultConfig.ctaText } : {}),
          ...(item.defaultConfig.align ? { align: item.defaultConfig.align } : {}),
          ...(item.defaultConfig.columns ? { columns: item.defaultConfig.columns } : {}),
        };
        await tx
          .update(pageSections)
          .set({
            enabled: item.enabled,
            sortOrder: index,
            config: sanitizeSectionConfig(item.type, mergedConfig),
            updatedAt: new Date(),
          })
          .where(eq(pageSections.id, found.id));
      } else {
        await tx.insert(pageSections).values({
          businessId: business.id,
          type: item.type,
          enabled: item.enabled,
          sortOrder: index,
          config: sanitizeSectionConfig(item.type, item.defaultConfig),
        });
      }
    }

    let extraIndex = preset.length;
    for (const s of existing) {
      if (!presetTypes.has(s.type)) {
        await tx
          .update(pageSections)
          .set({
            enabled: false,
            sortOrder: extraIndex++,
            updatedAt: new Date(),
          })
          .where(eq(pageSections.id, s.id));
      }
    }
  });

  const updated = await db
    .select()
    .from(pageSections)
    .where(eq(pageSections.businessId, business.id))
    .orderBy(pageSections.sortOrder);

  refresh(business.slug);
  return { ok: true, sections: updated };
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