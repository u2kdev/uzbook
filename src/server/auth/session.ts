import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb } from "@/server/db";
import { users, type User } from "@/server/db/schema";
import { readSession, sessionCookie, signSession, type SessionUser } from "./jwt";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  return readSession(store.get(sessionCookie.name)?.value);
}

export async function setSessionCookie(user: User) {
  const token = await signSession({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
  const store = await cookies();
  store.set(sessionCookie.name, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionCookie.maxAge,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(sessionCookie.name);
}

export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");

  // A JWT can outlive the user row (e.g. the database was reset). Never trust it blindly.
  const db = await getDb();
  const [row] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, session.id))
    .limit(1);

  if (!row) redirect("/login");
  return row.role === session.role ? session : { ...session, role: row.role };
}

export async function requireAdmin(): Promise<SessionUser> {
  const session = await requireUser();
  if (session.role !== "ADMIN" && session.role !== "SUPPORT") redirect("/dashboard");
  return session;
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session) return null;
  const db = await getDb();
  const [row] = await db.select().from(users).where(eq(users.id, session.id)).limit(1);
  return row ?? null;
}

/** Owner's first business (MVP: one business per account). */
export async function getMyBusiness() {
  const session = await requireUser();
  const db = await getDb();
  const { businesses } = await import("@/server/db/schema");
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.ownerId, session.id))
    .limit(1);
  return { session, business: business ?? null, db };
}
