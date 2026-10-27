import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "uz_session";
const MAX_AGE = 60 * 60 * 24 * 30;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "OWNER" | "SUPPORT" | "ADMIN";
};

function secret() {
  const value = process.env.AUTH_SECRET ?? "dev-only-secret-change-me-please-32chars-min";
  return new TextEncoder().encode(value);
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name, role: user.role })
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
    };
  } catch {
    return null;
  }
}

export const sessionCookie = {
  name: COOKIE_NAME,
  maxAge: MAX_AGE,
};
