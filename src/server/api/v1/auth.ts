import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { authSecret } from "@/server/config/env";
import { getDb } from "@/server/db";
import { businesses, users, type Business, type User } from "@/server/db/schema";
import type { SessionUser } from "@/server/auth/jwt";
import { ApiError } from "./response";

const ACCESS_TOKEN_TTL_SEC = 60 * 60; // 1 hour
const REFRESH_TOKEN_TTL_SEC = 60 * 60 * 24 * 30; // 30 days

function getSecret() {
  return new TextEncoder().encode(authSecret());
}

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: "Bearer";
};

export async function createAuthTokens(user: SessionUser): Promise<AuthTokens> {
  const secret = getSecret();
  const now = Math.floor(Date.now() / 1000);

  const accessToken = await new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
    typ: "access",
    jti: randomUUID(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt(now)
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SEC}s`)
    .sign(secret);

  const refreshToken = await new SignJWT({
    typ: "refresh",
    jti: randomUUID(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt(now)
    .setExpirationTime(`${REFRESH_TOKEN_TTL_SEC}s`)
    .sign(secret);

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_SEC,
    tokenType: "Bearer",
  };
}

export async function verifyAccessToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.typ !== "access" || !payload.sub || typeof payload.role !== "string") {
      return null;
    }
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

export async function verifyRefreshToken(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.typ !== "refresh" || !payload.sub) {
      return null;
    }
    return { userId: payload.sub };
  } catch {
    return null;
  }
}

export async function authenticateBearer(request: Request): Promise<{
  user: User;
  session: SessionUser;
  business: Business;
}> {
  const authHeader = request.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new ApiError(401, "unauthorized", "Требуется авторизация Bearer токеном");
  }

  const token = match[1].trim();
  const session = await verifyAccessToken(token);
  if (!session) {
    throw new ApiError(401, "invalid_token", "Токен доступа недействителен или срок его действия истёк");
  }

  const db = await getDb();
  const [userRow] = await db.select().from(users).where(eq(users.id, session.id)).limit(1);
  if (!userRow) {
    throw new ApiError(401, "user_not_found", "Пользователь не найден");
  }

  const [businessRow] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.ownerId, userRow.id))
    .limit(1);

  if (!businessRow) {
    throw new ApiError(403, "no_business", "У аккаунта нет привязанного бизнеса или салона");
  }

  return {
    user: userRow,
    session: {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      role: userRow.role,
    },
    business: businessRow,
  };
}
