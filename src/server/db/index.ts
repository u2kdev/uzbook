import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import path from "node:path";
import { mkdirSync } from "node:fs";
import postgres from "postgres";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  __uzbookDb?: DB;
  __uzbookDbReady?: Promise<DB>;
};

const migrationsFolder = path.resolve(process.cwd(), "drizzle");

async function createDb(): Promise<DB> {
  const url = process.env.DATABASE_URL?.trim();

  if (!url) {
    // Zero-install local development: embedded Postgres (WASM), data in ./.data/pg
    const dataDir = path.resolve(process.cwd(), ".data", "pg");
    mkdirSync(path.dirname(dataDir), { recursive: true });
    const client = new PGlite(dataDir);
    const db = drizzlePglite(client, { schema, casing: "snake_case" });
    await migratePglite(db, { migrationsFolder });
    return db as unknown as DB;
  }

  const client = postgres(url, { max: 10, prepare: false });
  const db = drizzlePostgres(client, { schema, casing: "snake_case" });

  // Locally migrations are applied automatically for convenience. In production
  // they run only when explicitly requested (Docker compose sets this flag),
  // otherwise use `npm run db:migrate` before starting the server.
  const migrateOnStart = ["1", "true", "on", "yes"].includes(
    process.env.RUN_MIGRATIONS_ON_START?.trim().toLowerCase() ?? "",
  );
  if (process.env.NODE_ENV !== "production" || migrateOnStart) {
    await migratePostgres(db, { migrationsFolder });
  }

  return db;
}

export function getDb(): Promise<DB> {
  if (!globalForDb.__uzbookDbReady) {
    globalForDb.__uzbookDbReady = createDb().then((db) => {
      globalForDb.__uzbookDb = db;
      return db;
    });
  }
  return globalForDb.__uzbookDbReady;
}

/** Await a ready database handle. */
export const db = new Proxy({} as DB, {
  get(_target, prop, receiver) {
    if (globalForDb.__uzbookDb) {
      return Reflect.get(globalForDb.__uzbookDb, prop, receiver);
    }
    throw new Error(
      "Database is not ready synchronously. Use `const db = await getDb()` inside async code.",
    );
  },
}) as DB;

export { schema };
export * from "./schema";
