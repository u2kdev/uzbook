"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db";
import { businesses, subscriptions, users } from "@/server/db/schema";
import {
  clearSessionCookie,
  getSession,
  hashPassword,
  requireUser,
  setSessionCookie,
  verifyPassword,
} from "@/server/auth/session";
import { rateLimit } from "@/server/http/rate-limit";
import { TRIAL_MS } from "@/lib/plans";
import { isValidSlug, slugify } from "@/lib/slug";
import { logger } from "@/server/logger";

export type AuthState = { error?: string } | null;

// Precomputed bcrypt hash (cost 10) used to equalize timing when a user email is not found.
const DUMMY_PASSWORD_HASH = "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

async function actionClientIp(): Promise<string> {
  const h = await headers();
  const realIp = h.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last;
  }
  return "unknown";
}

const loginCredentials = z.object({
  email: z.string().regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "Введите корректный email"),
  password: z.string().min(6, "Пароль минимум 6 символов").max(128),
});

const registerCredentials = z.object({
  email: z.string().regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "Введите корректный email"),
  password: z.string().min(8, "Пароль минимум 8 символов").max(128),
});

export async function registerAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const ip = await actionClientIp();
  const ipLimit = rateLimit(`web_register_ip:${ip}`, 10, 10 * 60_000);
  if (!ipLimit.ok) {
    return { error: "Слишком много попыток регистрации. Подождите несколько минут." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const parsed = registerCredentials.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  });

  if (!name || name.length < 2) return { error: "Как вас зовут? Минимум 2 символа." };
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const db = await getDb();
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);
  if (existing) return { error: "Этот email уже зарегистрирован. Попробуйте войти." };

  const passwordHash = await hashPassword(parsed.data.password);
  const [user] = await db
    .insert(users)
    .values({
      email: parsed.data.email,
      passwordHash,
      name: name.slice(0, 80),
      role: "OWNER",
    })
    .returning();

  logger.info("auth.register", { userId: user.id, role: user.role });

  await setSessionCookie(user);
  redirect("/onboarding");
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const ip = await actionClientIp();
  const ipLimit = rateLimit(`web_login_ip:${ip}`, 15, 60_000);
  if (!ipLimit.ok) {
    return { error: "Слишком много попыток входа. Попробуйте через минуту." };
  }

  const parsed = loginCredentials.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const emailLimit = rateLimit(`web_login_email:${parsed.data.email}`, 8, 60_000);
  if (!emailLimit.ok) {
    return { error: "Слишком много попыток входа для этого аккаунта. Подождите минуту." };
  }

  const db = await getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);
  if (!user) {
    await verifyPassword(parsed.data.password, DUMMY_PASSWORD_HASH);
    logger.warn("auth.login_failed", { reason: "user_not_found", ip });
    return { error: "Неверный email или пароль." };
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) {
    logger.warn("auth.login_failed", { userId: user.id, reason: "invalid_password", ip });
    return { error: "Неверный email или пароль." };
  }

  logger.info("auth.login_success", { userId: user.id, role: user.role });

  await setSessionCookie(user);
  redirect(user.role === "OWNER" ? "/dashboard" : "/admin");
}

export async function logoutAction() {
  const session = await getSession();
  if (session) {
    logger.info("auth.logout", { userId: session.id, email: session.email });
  }
  await clearSessionCookie();
  redirect("/");
}

const businessInput = z.object({
  name: z.string().min(2, "Название минимум 2 символа").max(80),
  slug: z.string().min(2, "Адрес слишком короткий").max(48),
  category: z.string().min(1),
  city: z.string().max(80).optional(),
});

export type OnboardingState = { error?: string; fieldErrors?: Record<string, string> } | null;

export async function createBusinessAction(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const session = await requireUser();
  const db = await getDb();

  const [existing] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.ownerId, session.id))
    .limit(1);
  if (existing) redirect("/dashboard");

  const parsed = businessInput.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    slug: slugify(String(formData.get("slug") ?? "")),
    category: String(formData.get("category") ?? "beauty"),
    city: String(formData.get("city") ?? "").trim() || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  if (!isValidSlug(parsed.data.slug)) {
    return {
      fieldErrors: {
        slug: "Латиница, цифры и дефис. Этот адрес занят или зарезервирован.",
      },
    };
  }

  const [taken] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.slug, parsed.data.slug))
    .limit(1);
  if (taken) return { fieldErrors: { slug: "Этот адрес уже занят. Выберите другой." } };

  const trialEndsAt = new Date(Date.now() + TRIAL_MS);

  await db.transaction(async (tx) => {
    const [business] = await tx
      .insert(businesses)
      .values({
        ownerId: session.id,
        name: parsed.data.name,
        slug: parsed.data.slug,
        category: parsed.data.category,
        city: parsed.data.city,
        phone: null,
        status: "ACTIVE",
        plan: "TRIAL",
        trialEndsAt,
      })
      .returning();

    await tx.insert(subscriptions).values({
      businessId: business.id,
      plan: "TRIAL",
      status: "TRIAL",
      provider: "MANUAL",
      currentPeriodEnd: trialEndsAt,
      note: "Автоматически выданный пробный период",
    });
  });

  redirect("/dashboard");
}

export async function currentSession() {
  return getSession();
}
