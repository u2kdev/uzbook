"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db";
import { businesses } from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { saveImage } from "@/server/storage";
import { storageLimitError, writeBlockedReason } from "@/server/limits";

export type ThemeState = { ok?: boolean; error?: string } | null;

export type UploadState = { ok?: boolean; error?: string; url?: string } | null;

export async function uploadBrandImageAction(
  kind: "logo" | "cover",
  formData: FormData,
): Promise<UploadState> {
  const { business } = await ownerBusiness();
  if (!business) return { error: "Сначала создайте бизнес" };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Выберите изображение" };

  const limitError = await storageLimitError(business, file.size);
  if (limitError) return { error: limitError };

  try {
    const saved = await saveImage(file);
    return { ok: true, url: saved.url };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Не удалось загрузить" };
  }
}

const imageUrl = z
  .string()
  .trim()
  .max(600)
  .refine(
    (value) => value === "" || value.startsWith("/api/uploads/") || /^https?:\/\//.test(value),
    "Ссылка должна начинаться с http(s):// или быть загруженным файлом",
  );

const themeSchema = z.object({
  businessId: z.string().uuid(),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Цвет должен быть в формате #7c5cff"),
  mode: z.enum(["light", "dark"]),
  fontPair: z.coerce.number().int().min(0).max(2),
  coverUrl: imageUrl,
  logoUrl: imageUrl,
});

async function ownerBusiness() {
  const session = await requireUser();
  if (session.role !== "OWNER") throw new Error("Только владелец может менять оформление");
  const db = await getDb();
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.ownerId, session.id))
    .limit(1);
  return { business, db };
}

export async function updateThemeAction(
  _previous: ThemeState,
  formData: FormData,
): Promise<ThemeState> {
  const { business, db } = await ownerBusiness();
  if (!business) return { error: "Сначала создайте бизнес" };

  const blocked = writeBlockedReason(business);
  if (blocked) return { error: blocked };

  const parsed = themeSchema.safeParse({
    businessId: String(formData.get("businessId") ?? ""),
    accent: String(formData.get("accent") ?? ""),
    mode: String(formData.get("mode") ?? "light"),
    fontPair: String(formData.get("fontPair") ?? "0"),
    coverUrl: String(formData.get("coverUrl") ?? ""),
    logoUrl: String(formData.get("logoUrl") ?? ""),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.businessId !== business.id) return { error: "Нет доступа" };

  const emptyToNull = (value: string) => (value.trim() === "" ? null : value.trim());

  await db
    .update(businesses)
    .set({
      theme: {
        accent: parsed.data.accent,
        mode: parsed.data.mode,
        fontPair: parsed.data.fontPair,
      },
      coverUrl: emptyToNull(parsed.data.coverUrl),
      logoUrl: emptyToNull(parsed.data.logoUrl),
    })
    .where(eq(businesses.id, business.id));

  revalidatePath("/dashboard/profile");
  revalidatePath(`/${business.slug}`);

  return { ok: true };
}
