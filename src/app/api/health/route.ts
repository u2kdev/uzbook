import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Liveness + database readiness probe for Docker / reverse proxies. */
export async function GET() {
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Healthcheck failed", error);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
