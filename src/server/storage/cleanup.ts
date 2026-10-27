import fs from "node:fs/promises";
import path from "node:path";
import { getDb } from "@/server/db";
import { businesses, galleryImages, pageSections, staff } from "@/server/db/schema";
import { uploadPath } from "@/server/storage";

const UPLOAD_DIR = path.resolve(process.cwd(), ".data", "uploads");
const MIN_ORPHAN_AGE_MS = 60 * 60 * 1000; // 1 hour grace period for in-flight uploads

export async function findReferencedUploadNames(): Promise<Set<string>> {
  const db = await getDb();
  const referenced = new Set<string>();

  const extractName = (url: string | null | undefined) => {
    if (url?.startsWith("/api/uploads/")) {
      referenced.add(url.slice("/api/uploads/".length));
    }
  };

  const [bizRows, staffRows, galleryRows, sectionRows] = await Promise.all([
    db.select({ logoUrl: businesses.logoUrl, coverUrl: businesses.coverUrl }).from(businesses),
    db.select({ photoUrl: staff.photoUrl }).from(staff),
    db.select({ url: galleryImages.url, beforeUrl: galleryImages.beforeUrl }).from(galleryImages),
    db.select({ config: pageSections.config }).from(pageSections),
  ]);

  for (const b of bizRows) {
    extractName(b.logoUrl);
    extractName(b.coverUrl);
  }
  for (const s of staffRows) {
    extractName(s.photoUrl);
  }
  for (const g of galleryRows) {
    extractName(g.url);
    extractName(g.beforeUrl);
  }
  for (const sec of sectionRows) {
    if (sec.config) {
      const json = JSON.stringify(sec.config);
      const matches = json.match(/\/api\/uploads\/[a-f0-9-]{36}\.(?:jpg|png|webp|gif)/gi);
      if (matches) {
        for (const m of matches) {
          extractName(m);
        }
      }
    }
  }

  return referenced;
}

export async function cleanOrphanedUploads(): Promise<{ deleted: number; freedBytes: number }> {
  let entries: string[];
  try {
    entries = await fs.readdir(UPLOAD_DIR);
  } catch {
    return { deleted: 0, freedBytes: 0 };
  }

  const referenced = await findReferencedUploadNames();
  const cutoff = Date.now() - MIN_ORPHAN_AGE_MS;
  let deleted = 0;
  let freedBytes = 0;

  for (const name of entries) {
    const filePath = uploadPath(name);
    if (!filePath) continue;

    if (!referenced.has(name)) {
      try {
        const stat = await fs.stat(filePath);
        if (stat.mtimeMs < cutoff) {
          await fs.rm(filePath, { force: true });
          deleted++;
          freedBytes += stat.size;
        }
      } catch {
        /* ignore concurrent removals */
      }
    }
  }

  return { deleted, freedBytes };
}
