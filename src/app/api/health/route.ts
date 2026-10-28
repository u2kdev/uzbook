import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Liveness + database readiness probe for Docker / reverse proxies / uptime monitoring. */
export async function GET() {
  const start = performance.now();
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    const dbLatencyMs = Math.round(performance.now() - start);

    return NextResponse.json(
      {
        status: "healthy",
        uptimeSeconds: Math.round(process.uptime()),
        database: {
          status: "connected",
          latencyMs: dbLatencyMs,
        },
        environment: process.env.NODE_ENV ?? "development",
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          "cache-control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database connection failed";
    console.error("Healthcheck probe failed:", error);

    return NextResponse.json(
      {
        status: "unhealthy",
        uptimeSeconds: Math.round(process.uptime()),
        database: {
          status: "disconnected",
          error: message,
        },
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: {
          "cache-control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  }
}
