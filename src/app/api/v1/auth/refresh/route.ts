import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { createAuthTokens, verifyRefreshToken } from "@/server/api/v1/auth";
import {
  apiError,
  apiSuccess,
  checkApiRateLimit,
  handleApiError,
} from "@/server/api/v1/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Токен обновления обязателен"),
});

export async function POST(request: Request) {
  const rateLimitErr = checkApiRateLimit(request, "auth_refresh", 30, 60_000);
  if (rateLimitErr) return rateLimitErr;

  try {
    const json = await request.json().catch(() => null);
    const parsed = refreshSchema.safeParse(json);
    if (!parsed.success) {
      return apiError("validation_error", "Поле refreshToken обязательно", 422);
    }

    const payload = await verifyRefreshToken(parsed.data.refreshToken);
    if (!payload) {
      return apiError(
        "invalid_refresh_token",
        "Токен обновления недействителен или истёк",
        401,
      );
    }

    const db = await getDb();
    const [user] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);

    if (!user) {
      return apiError("user_not_found", "Пользователь не найден", 401);
    }

    const tokens = await createAuthTokens({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    return apiSuccess({ tokens });
  } catch (err) {
    return handleApiError(err);
  }
}
