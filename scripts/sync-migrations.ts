/**
 * Records already-applied SQL files in drizzle.__drizzle_migrations.
 * Needed when a migration was applied manually (e.g. 0002_page_sections).
 * Safe to run multiple times.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

try {
  process.loadEnvFile?.(".env");
} catch {
  /* optional */
}

type JournalEntry = { idx: number; when: number; tag: string };

function pgliteDataDir(): string {
  const configured = process.env.PGLITE_DATA_DIR?.trim();
  return configured
    ? path.resolve(process.cwd(), configured)
    : path.resolve(process.cwd(), ".data", "pg");
}

async function main() {
  if (process.env.DATABASE_URL?.trim()) {
    console.log("DATABASE_URL is set — run npm run db:migrate instead.");
    return;
  }

  const folder = path.resolve(process.cwd(), "drizzle");
  const journal = JSON.parse(
    readFileSync(path.join(folder, "meta", "_journal.json"), "utf-8"),
  ) as { entries: JournalEntry[] };

  const client = new PGlite(pgliteDataDir());

  await client.exec(`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
  await client.exec(`CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint
  )`);

  const known = await client.query<{ hash: string }>(
    `SELECT hash FROM "drizzle"."__drizzle_migrations"`,
  );
  const hashes = new Set(known.rows.map((row) => row.hash));
  let added = 0;

  for (const entry of journal.entries) {
    const sql = readFileSync(path.join(folder, `${entry.tag}.sql`), "utf-8");
    const hash = createHash("sha256").update(sql).digest("hex");
    if (hashes.has(hash)) continue;

    await client.query(
      `INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at") VALUES ($1, $2)`,
      [hash, entry.when],
    );
    console.log(`Recorded ${entry.tag}`);
    added += 1;
  }

  await client.close();
  console.log(added === 0 ? "Migration journal already in sync." : `Recorded ${added} migration(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
