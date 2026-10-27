"use server";

import { redirect } from "next/navigation";
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
import { isValidSlug, slugify } from "@/lib/slug";
import { logger } from "@/server/logger";

export type AuthState = { error?: string } | null;

const credentials = z.object({
  email: z.string().regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "Введите корректный email"),
  password: z.string().min(6, "Пароль минимум 6 символов"),
});

export async function registerAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const name = String(formData.get("name") ?? "").trim();
  const parsed = credentials.safeParse({
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

  logger.info("auth.register", { userId: user.id, email: user.email, role: user.role });

  await setSessionCookie(user);
  redirect("/onboarding");
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const db = await getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);
  if (!user) {
    logger.warn("auth.login_failed", { email: parsed.data.email, reason: "user_not_found" });
    return { error: "Не нашли аккаунт с таким email." };
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) {
    logger.warn("auth.login_failed", { email: user.email, userId: user.id, reason: "invalid_password" });
    return { error: "Неверный пароль." };
  }

  logger.info("auth.login_success", { userId: user.id, email: user.email, role: user.role });

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

  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

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
