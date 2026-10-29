import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { authSecret } from "@/server/config/env";
import { getDb } from "@/server/db";
import { businesses, users, type Business, type User } from "@/server/db/schema";
import { tokenFingerprint, type SessionUser } from "@/server/auth/jwt";
import { ApiError } from "./response";

const ACCESS_TOKEN_TTL_SEC = 60 * 60; // 1 hour
const REFRESH_TOKEN_TTL_SEC = 60 * 60 * 24 * 30; // 30 days

// Track consumed refresh token JTIs so each refresh token can only be exchanged once.
const consumedRefreshJtis = new Map<string, number>();
let lastJtiSweep = 0;

function consumeRefreshJti(jti: string, expSeconds?: number): boolean {
  const now = Date.now();
  if (now - lastJtiSweep > 60_000) {
    for (const [key, expiresAt] of consumedRefreshJtis) {
      if (expiresAt <= now) consumedRefreshJtis.delete(key);
    }
    lastJtiSweep = now;
  }
  const existingExp = consumedRefreshJtis.get(jti);
  if (existingExp && existingExp > now) {
    return false;
  }
  const expiresAt = expSeconds ? expSeconds * 1000 : now + REFRESH_TOKEN_TTL_SEC * 1000;
  consumedRefreshJtis.set(jti, expiresAt);
  return true;
}

function getSecret() {
  return new TextEncoder().encode(authSecret());
}

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: "Bearer";
};

export async function createAuthTokens(
  user: SessionUser & { passwordHash?: string },
): Promise<AuthTokens> {
  const secret = getSecret();
  const now = Math.floor(Date.now() / 1000);
  const ver =
    user.ver ?? (user.passwordHash ? tokenFingerprint(user.passwordHash, user.role) : undefined);

  const accessToken = await new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
    ...(ver ? { ver } : {}),
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
    ...(ver ? { ver } : {}),
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
      ver: typeof payload.ver === "string" ? payload.ver : undefined,
    };
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(
  token: string,
): Promise<{ userId: string; ver?: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.typ !== "refresh" || !payload.sub || typeof payload.jti !== "string") {
      return null;
    }
    if (!consumeRefreshJti(payload.jti, payload.exp)) {
      return null;
    }
    return {
      userId: payload.sub,
      ver: typeof payload.ver === "string" ? payload.ver : undefined,
    };
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

  if (session.ver && session.ver !== tokenFingerprint(userRow.passwordHash, userRow.role)) {
    throw new ApiError(401, "invalid_token", "Сессия устарела. Войдите заново");
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
