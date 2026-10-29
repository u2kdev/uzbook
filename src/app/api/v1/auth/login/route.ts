import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db";
import { businesses, users } from "@/server/db/schema";
import { verifyPassword } from "@/server/auth/session";
import { createAuthTokens } from "@/server/api/v1/auth";
import {
  apiError,
  apiSuccess,
  checkApiRateLimit,
  handleApiError,
} from "@/server/api/v1/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().trim().email("Неверный формат email").toLowerCase(),
  password: z.string().min(1, "Пароль не может быть пустым"),
});

export async function POST(request: Request) {
  const rateLimitErr = checkApiRateLimit(request, "auth_login", 15, 60_000);
  if (rateLimitErr) return rateLimitErr;

  try {
    const json = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(json);
    if (!parsed.success) {
      return apiError(
        "validation_error",
        parsed.error.issues[0]?.message ?? "Неверные учетные данные",
        422,
        parsed.error.issues,
      );
    }

    const { email, password } = parsed.data;
    const db = await getDb();
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user) {
      return apiError("invalid_credentials", "Неверный email или пароль", 401);
    }

    const passwordOk = await verifyPassword(password, user.passwordHash);
    if (!passwordOk) {
      return apiError("invalid_credentials", "Неверный email или пароль", 401);
    }

    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.ownerId, user.id))
      .limit(1);

    const tokens = await createAuthTokens({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      passwordHash: user.passwordHash,
    });

    return apiSuccess({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
      },
      business: business
        ? {
            id: business.id,
            name: business.name,
            slug: business.slug,
            category: business.category,
            plan: business.plan,
          }
        : null,
      tokens,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
