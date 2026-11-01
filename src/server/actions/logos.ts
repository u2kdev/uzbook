"use server";

import { revalidatePath } from "next/cache";
import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { trustedLogos, type TrustedLogo } from "@/server/db/schema";
import { requireAdmin } from "@/server/auth/session";
import { deleteUpload, saveImage } from "@/server/storage";
import { recordAuditLog } from "@/server/payments/service";

export type LogoActionState = {
  ok?: boolean;
  error?: string;
} | null;

function refreshLogos() {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/logos");
  revalidatePath("/admin/logs");
}

export async function getTrustedLogos(onlyEnabled = false): Promise<TrustedLogo[]> {
  try {
    const db = await getDb();
    if (onlyEnabled) {
      return await db
        .select()
        .from(trustedLogos)
        .where(eq(trustedLogos.enabled, true))
        .orderBy(asc(trustedLogos.sortOrder), asc(trustedLogos.createdAt));
    }
    return await db
      .select()
      .from(trustedLogos)
      .orderBy(asc(trustedLogos.sortOrder), asc(trustedLogos.createdAt));
  } catch {
    return [];
  }
}

export async function uploadTrustedLogoAction(
  _prev: LogoActionState,
  formData: FormData,
): Promise<LogoActionState> {
  const session = await requireAdmin();
  if (session.role !== "ADMIN") {
    return { error: "Только главный администратор может управлять логотипами" };
  }

  const name = String(formData.get("name") ?? "").trim();
  const linkUrl = String(formData.get("linkUrl") ?? "").trim() || null;
  const directUrl = String(formData.get("imageUrl") ?? "").trim();
  const file = formData.get("file");

  if (name.length < 2) {
    return { error: "Укажите название компании или салона" };
  }

  if (linkUrl && !/^https?:\/\/.+/i.test(linkUrl)) {
    return { error: "Ссылка должна начинаться с http:// или https://" };
  }

  if (
    directUrl &&
    !directUrl.startsWith("/api/uploads/") &&
    !/^https?:\/\/.+/i.test(directUrl)
  ) {
    return { error: "Ссылка на изображение должна начинаться с https:// или быть загруженным файлом" };
  }

  let finalImageUrl = directUrl;
  let uploadedUrl: string | null = null;

  try {
    if (file instanceof File && file.size > 0) {
      const saved = await saveImage(file);
      finalImageUrl = saved.url;
      uploadedUrl = saved.url;
    }

    if (!finalImageUrl) {
      return { error: "Загрузите PNG-файл логотипа или укажите ссылку на изображение" };
    }

    const db = await getDb();
    const [{ nextOrder }] = await db
      .select({ nextOrder: sql<number>`coalesce(max(${trustedLogos.sortOrder}) + 1, 0)` })
      .from(trustedLogos);

    const [created] = await db
      .insert(trustedLogos)
      .values({
        name: name.slice(0, 100),
        imageUrl: finalImageUrl,
        linkUrl: linkUrl?.slice(0, 300) ?? null,
        enabled: true,
        sortOrder: Number(nextOrder) || 0,
      })
      .returning();

    await recordAuditLog({
      userId: session.id,
      action: "admin.logo_added",
      entityType: "trusted_logo",
      entityId: created.id,
      details: { name: created.name, imageUrl: created.imageUrl },
    });

    refreshLogos();
    return { ok: true };
  } catch (error) {
    if (uploadedUrl) await deleteUpload(uploadedUrl);
    return {
      error: error instanceof Error ? error.message : "Не удалось загрузить логотип",
    };
  }
}

export async function toggleTrustedLogoAction(
  id: string,
  enabled: boolean,
): Promise<LogoActionState> {
  const session = await requireAdmin();
  if (session.role !== "ADMIN") return { error: "Недостаточно прав" };

  const db = await getDb();
  await db.update(trustedLogos).set({ enabled }).where(eq(trustedLogos.id, id));

  await recordAuditLog({
    userId: session.id,
    action: "admin.logo_toggled",
    entityType: "trusted_logo",
    entityId: id,
    details: { enabled },
  });

  refreshLogos();
  return { ok: true };
}

export async function deleteTrustedLogoAction(id: string): Promise<LogoActionState> {
  const session = await requireAdmin();
  if (session.role !== "ADMIN") return { error: "Недостаточно прав" };

  const db = await getDb();
  const [logo] = await db
    .select()
    .from(trustedLogos)
    .where(eq(trustedLogos.id, id))
    .limit(1);

  if (!logo) return { error: "Логотип не найден" };

  await db.delete(trustedLogos).where(eq(trustedLogos.id, id));
  await deleteUpload(logo.imageUrl);

  await recordAuditLog({
    userId: session.id,
    action: "admin.logo_deleted",
    entityType: "trusted_logo",
    entityId: id,
    details: { name: logo.name },
  });

  refreshLogos();
  return { ok: true };
}
