import { mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { migrate as migratePg } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

try {
  process.loadEnvFile?.(".env");
} catch {
  /* .env is optional */
}

const folder = path.resolve(process.cwd(), "drizzle");
const url = process.env.DATABASE_URL?.trim();

async function main() {
  if (url) {
    const client = postgres(url, { max: 1 });
    await migratePg(drizzlePg(client), { migrationsFolder: folder });
    await client.end();
    console.log("Migrations applied to", url.replace(/\/\/.*@/, "//***@"));
  } else {
    const dataDir = path.resolve(process.cwd(), ".data", "pg");
    mkdirSync(path.dirname(dataDir), { recursive: true });
    const client = new PGlite(dataDir);
    await migrate(drizzle(client), { migrationsFolder: folder });
    await client.close();
    console.log("Migrations applied to local PGlite");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
