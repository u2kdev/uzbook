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

/**
 * Inspects magic bytes of the uploaded buffer to verify it is a genuine
 * JPEG, PNG, GIF, or WebP image (prevents MIME-type spoofing).
 */
function detectImageExt(buf: Buffer): string | null {
  if (buf.length < 12) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "jpg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "png";
  }

  // GIF: "GIF87a" or "GIF89a"
  if (
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) &&
    buf[5] === 0x61
  ) {
    return "gif";
  }

  // WebP: "RIFF" .... "WEBP"
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "webp";
  }

  return null;
}

export type StoredFile = { url: string; name: string; bytes: number };

/**
 * Saves an uploaded image into `.data/uploads` and returns its public URL.
 * Works on a self-hosted server / Docker volume — no external blob provider.
 */
export async function saveImage(file: File): Promise<StoredFile> {
  if (!file || file.size === 0) throw new Error("Файл не выбран");
  if (file.size > MAX_BYTES) throw new Error("Файл больше 5 МБ");

  if (!MIME_EXT[file.type]) {
    throw new Error("Поддерживаются JPG, PNG, WebP и GIF");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = detectImageExt(buffer);
  if (!ext) {
    throw new Error("Повреждённый файл или неподдерживаемый формат изображения");
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, name), buffer);

  return { url: `/api/uploads/${name}`, name, bytes: buffer.length };
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
