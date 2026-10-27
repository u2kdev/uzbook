"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { businesses, galleryImages, type GalleryImage } from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { deleteUpload, saveImage } from "@/server/storage";
import { storageLimitError, writeBlockedReason } from "@/server/limits";

export type GalleryState = { ok?: boolean; error?: string; images?: GalleryImage[] } | null;

async function currentBusiness() {
  const session = await requireUser();
  if (session.role !== "OWNER") throw new Error("Только владелец может менять галерею");
  const db = await getDb();
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.ownerId, session.id))
    .limit(1);
  return { business, db };
}

function refresh(slug?: string) {
  revalidatePath("/dashboard/profile");
  if (slug) revalidatePath(`/${slug}`);
}

export async function listGalleryImages() {
  const { business, db } = await currentBusiness();
  if (!business) return [];
  return db
    .select()
    .from(galleryImages)
    .where(eq(galleryImages.businessId, business.id))
    .orderBy(galleryImages.sortOrder, galleryImages.createdAt);
}

export async function uploadGalleryImageAction(formData: FormData): Promise<GalleryState> {
  const { business, db } = await currentBusiness();
  if (!business) return { error: "Сначала создайте бизнес" };

  const after = formData.get("after");
  const before = formData.get("before");
  const caption = String(formData.get("caption") ?? "").trim().slice(0, 160);

  if (!(after instanceof File) || after.size === 0) {
    return { error: "Выберите фото работы" };
  }

  const extraBytes =
    after.size + (before instanceof File && before.size > 0 ? before.size : 0);
  const limitError = await storageLimitError(business, extraBytes);
  if (limitError) return { error: limitError };

  try {
    const saved = await saveImage(after);
    let beforeUrl: string | null = null;

    if (before instanceof File && before.size > 0) {
      const savedBefore = await saveImage(before);
      beforeUrl = savedBefore.url;
    }

    const [{ nextOrder }] = await db
      .select({ nextOrder: sql<number>`coalesce(max(${galleryImages.sortOrder}) + 1, 0)` })
      .from(galleryImages)
      .where(eq(galleryImages.businessId, business.id));

    await db.insert(galleryImages).values({
      businessId: business.id,
      url: saved.url,
      beforeUrl,
      caption: caption || null,
      sortOrder: Number(nextOrder) || 0,
    });

    refresh(business.slug);
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Не удалось загрузить фото" };
  }
}

export async function updateGalleryCaptionAction(
  imageId: string,
  caption: string,
): Promise<GalleryState> {
  const { business, db } = await currentBusiness();
  if (!business) return { error: "Нет доступа" };

  const blocked = writeBlockedReason(business);
  if (blocked) return { error: blocked };

  await db
    .update(galleryImages)
    .set({ caption: caption.trim().slice(0, 160) || null })
    .where(and(eq(galleryImages.id, imageId), eq(galleryImages.businessId, business.id)));

  refresh(business.slug);
  return { ok: true };
}

export async function deleteGalleryImageAction(imageId: string): Promise<GalleryState> {
  const { business, db } = await currentBusiness();
  if (!business) return { error: "Нет доступа" };

  const [image] = await db
    .select()
    .from(galleryImages)
    .where(and(eq(galleryImages.id, imageId), eq(galleryImages.businessId, business.id)))
    .limit(1);

  if (!image) return { error: "Фото не найдено" };

  await db
    .delete(galleryImages)
    .where(and(eq(galleryImages.id, imageId), eq(galleryImages.businessId, business.id)));

  await deleteUpload(image.url);
  await deleteUpload(image.beforeUrl);

  refresh(business.slug);
  return { ok: true };
}

export async function reorderGalleryAction(ids: string[]): Promise<GalleryState> {
  const { business, db } = await currentBusiness();
  if (!business) return { error: "Нет доступа" };

  const blocked = writeBlockedReason(business);
  if (blocked) return { error: blocked };

  await db.transaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx
        .update(galleryImages)
        .set({ sortOrder: index })
        .where(and(eq(galleryImages.id, id), eq(galleryImages.businessId, business.id)));
    }
  });

  refresh(business.slug);
  return { ok: true };
}
