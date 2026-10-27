import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const UPLOAD_DIR = path.resolve(process.cwd(), ".data", "uploads");
const MAX_BYTES = 5 * 1024 * 1024;

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export type StoredFile = { url: string; name: string; bytes: number };

/**
 * Saves an uploaded image into `.data/uploads` and returns its public URL.
 * Works on a self-hosted server / Docker volume — no external blob provider.
 */
export async function saveImage(file: File): Promise<StoredFile> {
  if (!file || file.size === 0) throw new Error("Файл не выбран");
  if (file.size > MAX_BYTES) throw new Error("Файл больше 5 МБ");

  const ext = MIME_EXT[file.type];
  if (!ext) throw new Error("Поддерживаются JPG, PNG, WebP и GIF");

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(UPLOAD_DIR, name), buffer);

  return { url: `/api/uploads/${name}`, name, bytes: file.size };
}

/** Resolves an upload name to an absolute path, guarding against traversal. */
export function uploadPath(name: string): string | null {
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp|gif)$/i.test(name)) return null;
  return path.join(UPLOAD_DIR, name);
}

/** Sums the size of locally stored images referenced by the given URLs. */
export async function storageBytesForUrls(
  urls: Array<string | null | undefined>,
): Promise<number> {
  let total = 0;
  for (const url of urls) {
    if (!url?.startsWith("/api/uploads/")) continue;
    const filePath = uploadPath(url.slice("/api/uploads/".length));
    if (!filePath) continue;
    try {
      const stat = await fs.stat(filePath);
      total += stat.size;
    } catch {
      /* file was removed manually — do not count it */
    }
  }
  return total;
}

export async function deleteUpload(url: string | null | undefined) {
  if (!url?.startsWith("/api/uploads/")) return;
  const name = url.slice("/api/uploads/".length);
  const filePath = uploadPath(name);
  if (!filePath) return;
  await fs.rm(filePath, { force: true });
}

export const UPLOAD_LIMITS = { maxBytes: MAX_BYTES, accept: "image/jpeg,image/png,image/webp,image/gif" };
