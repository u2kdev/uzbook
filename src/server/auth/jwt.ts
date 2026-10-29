import { createHmac } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { authSecret } from "@/server/config/env";

const COOKIE_NAME = "uz_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "OWNER" | "SUPPORT" | "ADMIN";
  ver?: string;
};

function secret() {
  return new TextEncoder().encode(authSecret());
}

/**
 * Computes a short HMAC fingerprint of the user's passwordHash + role.
 * Embedding this in JWTs allows immediate token invalidation whenever a user's
 * password or role changes, without requiring a schema migration.
 */
export function tokenFingerprint(passwordHash: string, role: string): string {
  return createHmac("sha256", authSecret())
    .update(`${passwordHash}:${role}`)
    .digest("hex")
    .slice(0, 16);
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
    ...(user.ver ? { ver: user.ver } : {}),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
}

export async function readSession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub || typeof payload.role !== "string") return null;
    return {
      id: payload.sub,
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
      role: payload.role as SessionUser["role"],
      ver: typeof payload.ver === "string" ? payload.ver : undefined,
    };
  } catch {
    return null;
  }
}

export const sessionCookie = {
  name: COOKIE_NAME,
  maxAge: MAX_AGE,
};
