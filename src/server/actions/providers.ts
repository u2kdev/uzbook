"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, or } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  businesses,
  providerApplications,
  subscriptions,
  users,
} from "@/server/db/schema";
import { hashPassword, requireAdmin, requireProvider } from "@/server/auth/session";
import { isValidSlug, slugify } from "@/lib/slug";
import { recordAuditLog } from "@/server/payments/service";
import type { PlanId } from "@/lib/plans";

export type ProviderActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
} | null;

function refreshAll() {
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/providers");
  revalidatePath("/admin/logs");
  revalidatePath("/admin/businesses");
  revalidatePath("/admin/requests");
  revalidatePath("/provider");
}

/**
 * 1. Public form submission: Apply to become a provider (/become-provider).
 * Applicant does NOT get immediate access; Admin reviews and creates username/password + commission %.
 */
export async function submitProviderApplicationAction(
  _prev: ProviderActionState,
  formData: FormData,
): Promise<ProviderActionState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase() || null;
  const telegram = String(formData.get("telegram") ?? "").trim() || null;
  const city = String(formData.get("city") ?? "").trim() || null;
  const payoutCard = String(formData.get("payoutCard") ?? "").trim() || null;
  const experienceNote = String(formData.get("experienceNote") ?? "").trim() || null;

  if (fullName.length < 2) {
    return { error: "Укажите ваше имя и фамилию (минимум 2 символа)" };
  }
  if (phone.replace(/\D/g, "").length < 7) {
    return { error: "Укажите корректный номер телефона для связи" };
  }

  const db = await getDb();
  const [created] = await db
    .insert(providerApplications)
    .values({
      fullName: fullName.slice(0, 120),
      phone: phone.slice(0, 40),
      email: email?.slice(0, 120) ?? null,
      telegram: telegram?.slice(0, 80) ?? null,
      city: city?.slice(0, 80) ?? null,
      payoutCard: payoutCard?.slice(0, 60) ?? null,
      experienceNote: experienceNote?.slice(0, 1000) ?? null,
      status: "PENDING",
    })
    .returning();

  await recordAuditLog({
    userId: null,
    action: "provider.application_submitted",
    entityType: "provider_application",
    entityId: created.id,
    details: {
      fullName,
      phone,
      email,
      telegram,
      city,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/providers");
  revalidatePath("/admin/logs");

  return {
    ok: true,
    message:
      "Заявка успешно отправлена! Владелец платформы рассмотрит её, свяжется с вами и выдаст персональный никнейм и пароль для входа в кабинет провайдера.",
  };
}

/**
 * 2. Admin action: Approve a provider application OR create a provider account directly,
 * setting their nickname (username), password, commissionPercent (default 60%), and payoutCard.
 */
export async function createOrApproveProviderAction(
  _prev: ProviderActionState,
  formData: FormData,
): Promise<ProviderActionState> {
  const session = await requireAdmin();
  if (session.role !== "ADMIN") {
    return { error: "Только главный администратор может оформлять провайдеров" };
  }

  const applicationId = String(formData.get("applicationId") ?? "").trim() || null;
  const name = String(formData.get("name") ?? "").trim();
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  const password = String(formData.get("password") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const rawEmail = String(formData.get("email") ?? "").trim().toLowerCase();
  const email = rawEmail || `${username}@provider.uzbook.online`;
  const payoutCard = String(formData.get("payoutCard") ?? "").trim() || null;
  const rawCommission = Number(formData.get("commissionPercent") ?? 60);
  const commissionPercent = Number.isFinite(rawCommission)
    ? Math.min(100, Math.max(0, Math.round(rawCommission)))
    : 60;

  if (name.length < 2) return { error: "Укажите имя провайдера" };
  if (username.length < 3 || !/^[a-z0-9_.-]+$/.test(username)) {
    return {
      error: "Никнейм должен содержать минимум 3 символа (латинские буквы, цифры, _, - или .)",
    };
  }
  if (password.length < 6) {
    return { error: "Пароль должен быть минимум 6 символов" };
  }

  const db = await getDb();

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.username, username), eq(users.email, email)))
    .limit(1);

  if (existing) {
    return { error: "Такой никнейм или email уже занят другим пользователем" };
  }

  const passwordHash = await hashPassword(password);

  const [providerUser] = await db
    .insert(users)
    .values({
      name: name.slice(0, 100),
      email,
      username,
      passwordHash,
      phone,
      role: "PROVIDER",
      commissionPercent,
      payoutCard,
    })
    .returning();

  if (applicationId) {
    await db
      .update(providerApplications)
      .set({
        status: "APPROVED",
        approvedUserId: providerUser.id,
        reviewedByUserId: session.id,
        updatedAt: new Date(),
      })
      .where(eq(providerApplications.id, applicationId));
  }

  await recordAuditLog({
    userId: session.id,
    action: "admin.provider_created",
    entityType: "user",
    entityId: providerUser.id,
    details: {
      providerName: providerUser.name,
      username: providerUser.username,
      commissionPercent: providerUser.commissionPercent,
      payoutCard: providerUser.payoutCard,
      applicationId,
    },
  });

  refreshAll();
  return {
    ok: true,
    message: `Провайдер «${providerUser.name}» создан! Логин: ${username}, комиссия: ${commissionPercent}%`,
  };
}

export async function declineProviderApplicationAction(
  applicationId: string,
): Promise<ProviderActionState> {
  const session = await requireAdmin();
  if (session.role !== "ADMIN") return { error: "Недостаточно прав" };

  const db = await getDb();
  await db
    .update(providerApplications)
    .set({
      status: "DECLINED",
      reviewedByUserId: session.id,
      updatedAt: new Date(),
    })
    .where(eq(providerApplications.id, applicationId));

  await recordAuditLog({
    userId: session.id,
    action: "admin.provider_application_declined",
    entityType: "provider_application",
    entityId: applicationId,
    details: {},
  });

  refreshAll();
  return { ok: true };
}

/**
 * 3. Admin action: Update provider's commission %, payout card, username, or password.
 */
export async function updateProviderSettingsAction(
  _prev: ProviderActionState,
  formData: FormData,
): Promise<ProviderActionState> {
  const session = await requireAdmin();
  if (session.role !== "ADMIN") return { error: "Недостаточно прав" };

  const providerId = String(formData.get("providerId") ?? "").trim();
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  const newPassword = String(formData.get("newPassword") ?? "").trim();
  const payoutCard = String(formData.get("payoutCard") ?? "").trim() || null;
  const rawCommission = Number(formData.get("commissionPercent") ?? 60);
  const commissionPercent = Number.isFinite(rawCommission)
    ? Math.min(100, Math.max(0, Math.round(rawCommission)))
    : 60;

  if (!providerId) return { error: "Провайдер не найден" };

  const db = await getDb();
  const updates: Partial<typeof users.$inferInsert> = {
    commissionPercent,
    payoutCard,
  };

  if (username && username.length >= 3) {
    updates.username = username;
  }
  if (newPassword && newPassword.length >= 6) {
    updates.passwordHash = await hashPassword(newPassword);
  }

  await db.update(users).set(updates).where(eq(users.id, providerId));

  await recordAuditLog({
    userId: session.id,
    action: "admin.provider_updated",
    entityType: "user",
    entityId: providerId,
    details: {
      username: updates.username,
      commissionPercent,
      payoutCard,
      passwordReset: Boolean(newPassword),
    },
  });

  refreshAll();
  return { ok: true, message: "Настройки провайдера сохранены" };
}

/**
 * 4. Provider action: Connect a new client (salon owner + business) and customize their subscription:
 *    - customClientLimit (количество людей/клиентов)
 *    - customStaffLimit (количество сотрудников/мастеров)
 *    - trialDays (14–30 дней бесплатно)
 *    - customPriceUzs (своя цена подписки; оплата идёт главному владельцу, а провайдеру % на карту)
 */
export async function providerConnectClientAction(
  _prev: ProviderActionState,
  formData: FormData,
): Promise<ProviderActionState> {
  const session = await requireProvider();
  const db = await getDb();

  const [providerUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.id))
    .limit(1);
  if (!providerUser) return { error: "Аккаунт провайдера не найден" };

  const ownerName = String(formData.get("ownerName") ?? "").trim();
  const ownerEmail = String(formData.get("ownerEmail") ?? "").trim().toLowerCase();
  const ownerPassword = String(formData.get("ownerPassword") ?? "").trim();
  const ownerPhone = String(formData.get("ownerPhone") ?? "").trim() || null;

  const businessName = String(formData.get("businessName") ?? "").trim();
  const rawSlug = slugify(String(formData.get("slug") ?? businessName));
  const category = String(formData.get("category") ?? "beauty").trim();
  const city = String(formData.get("city") ?? "Ташкент").trim();

  const customStaffLimit = Math.max(1, Math.min(500, Math.round(Number(formData.get("customStaffLimit") ?? 5) || 5)));
  const customClientLimit = Math.max(10, Math.min(100_000, Math.round(Number(formData.get("customClientLimit") ?? 500) || 500)));
  const trialDays = Math.max(14, Math.min(30, Math.round(Number(formData.get("trialDays") ?? 14) || 14)));
  const customPriceUzs = Math.max(0, Math.round(Number(String(formData.get("customPriceUzs") ?? "199000").replace(/\s+/g, "")) || 199000));
  const basePlan = (String(formData.get("plan") ?? "PRO") as PlanId) || "PRO";
  const sendPaymentRequestNow = formData.get("sendPaymentRequestNow") === "true";

  if (ownerName.length < 2) return { error: "Укажите имя владельца салона" };
  if (!ownerEmail.includes("@")) return { error: "Укажите корректный email владельца для входа" };
  if (ownerPassword.length < 6) return { error: "Пароль клиента должен быть минимум 6 символов" };
  if (businessName.length < 2) return { error: "Укажите название салона / бизнеса" };
  if (!isValidSlug(rawSlug)) {
    return { error: "Адрес страницы (slug) должен содержать латинские буквы и цифры" };
  }

  const [existingEmail] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, ownerEmail))
    .limit(1);
  if (existingEmail) return { error: "Клиент с таким email уже зарегистрирован на платформе" };

  const [existingSlug] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.slug, rawSlug))
    .limit(1);
  if (existingSlug) return { error: "Такой адрес страницы (slug) уже занят, укажите другой" };

  const passwordHash = await hashPassword(ownerPassword);
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
  const commissionPercent = providerUser.commissionPercent ?? 60;
  const providerPayoutAmount = Math.round((customPriceUzs * commissionPercent) / 100);

  const createdBusiness = await db.transaction(async (tx) => {
    const [newOwner] = await tx
      .insert(users)
      .values({
        name: ownerName.slice(0, 100),
        email: ownerEmail,
        passwordHash,
        phone: ownerPhone,
        role: "OWNER",
      })
      .returning();

    const [biz] = await tx
      .insert(businesses)
      .values({
        ownerId: newOwner.id,
        providerId: providerUser.id,
        name: businessName.slice(0, 80),
        slug: rawSlug,
        category,
        city,
        phone: ownerPhone,
        status: "ACTIVE",
        plan: "TRIAL",
        trialEndsAt,
        customStaffLimit,
        customClientLimit,
        customPriceUzs,
      })
      .returning();

    // Create initial customized trial subscription (14–30 days free)
    await tx.insert(subscriptions).values({
      businessId: biz.id,
      providerId: providerUser.id,
      plan: "TRIAL",
      status: "TRIAL",
      provider: "MANUAL",
      amount: 0,
      currency: "UZS",
      customStaffLimit,
      customClientLimit,
      providerCommissionPercent: commissionPercent,
      providerPayoutAmount: 0,
      startedAt: now,
      currentPeriodEnd: trialEndsAt,
      note: `Подключено провайдером ${providerUser.name} (${trialDays} дн. бесплатно · до ${customStaffLimit} сотр. · до ${customClientLimit} кл. · тариф ${customPriceUzs.toLocaleString("ru-RU")} сум)`,
    });

    // If provider also submits the paid subscription request right away
    if (sendPaymentRequestNow && customPriceUzs > 0) {
      await tx.insert(subscriptions).values({
        businessId: biz.id,
        providerId: providerUser.id,
        plan: ["START", "PRO", "BUSINESS"].includes(basePlan) ? basePlan : "PRO",
        status: "PENDING",
        provider: "MANUAL",
        amount: customPriceUzs,
        currency: "UZS",
        customStaffLimit,
        customClientLimit,
        providerCommissionPercent: commissionPercent,
        providerPayoutAmount,
        startedAt: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        note: `Индивидуальный тариф от провайдера ${providerUser.name}: цена ${customPriceUzs.toLocaleString("ru-RU")} сум (выплата провайдеру ${commissionPercent}% = ${providerPayoutAmount.toLocaleString("ru-RU")} сум на карту ${providerUser.payoutCard || "не указана"})`,
      });
    }

    return biz;
  });

  await recordAuditLog({
    userId: providerUser.id,
    action: "provider.client_connected",
    entityType: "business",
    entityId: createdBusiness.id,
    details: {
      providerName: providerUser.name,
      providerUsername: providerUser.username,
      businessName: createdBusiness.name,
      businessSlug: createdBusiness.slug,
      ownerEmail,
      trialDays,
      customStaffLimit,
      customClientLimit,
      customPriceUzs,
      commissionPercent,
      providerPayoutAmount,
      sendPaymentRequestNow,
    },
  });

  refreshAll();
  return {
    ok: true,
    message: `Клиент «${createdBusiness.name}» успешно подключён! Выдано ${trialDays} дней бесплатно. Ваша доля при оплате (${commissionPercent}%): ${providerPayoutAmount.toLocaleString("ru-RU")} UZS.`,
  };
}

/**
 * 5. Provider action: Customize an existing connected client's subscription
 *    (staff limit, client/people limit, 14–30 days free trial, custom price, and/or send payment request).
 */
export async function providerCustomizeSubscriptionAction(
  _prev: ProviderActionState,
  formData: FormData,
): Promise<ProviderActionState> {
  const session = await requireProvider();
  const db = await getDb();

  const [providerUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.id))
    .limit(1);
  if (!providerUser) return { error: "Провайдер не найден" };

  const businessId = String(formData.get("businessId") ?? "").trim();
  const customStaffLimit = Math.max(1, Math.min(500, Math.round(Number(formData.get("customStaffLimit") ?? 5) || 5)));
  const customClientLimit = Math.max(10, Math.min(100_000, Math.round(Number(formData.get("customClientLimit") ?? 500) || 500)));
  const trialDays = Math.max(0, Math.min(30, Math.round(Number(formData.get("trialDays") ?? 0) || 0)));
  const customPriceUzs = Math.max(0, Math.round(Number(String(formData.get("customPriceUzs") ?? "199000").replace(/\s+/g, "")) || 199000));
  const createPaymentRequest = formData.get("createPaymentRequest") === "true";

  const [business] = await db
    .select()
    .from(businesses)
    .where(
      session.role === "ADMIN"
        ? eq(businesses.id, businessId)
        : and(eq(businesses.id, businessId), eq(businesses.providerId, session.id)),
    )
    .limit(1);

  if (!business) return { error: "Клиент (салон) не найден или не привязан к вашему аккаунту" };

  const now = new Date();
  const safeTrialDays = trialDays > 0 ? Math.max(14, Math.min(30, trialDays)) : 0;
  const newTrialEndsAt =
    safeTrialDays > 0
      ? new Date(now.getTime() + safeTrialDays * 24 * 60 * 60 * 1000)
      : business.trialEndsAt;

  const commissionPercent = providerUser.commissionPercent ?? 60;
  const providerPayoutAmount = Math.round((customPriceUzs * commissionPercent) / 100);

  await db.transaction(async (tx) => {
    await tx
      .update(businesses)
      .set({
        customStaffLimit,
        customClientLimit,
        customPriceUzs,
        ...(safeTrialDays > 0 ? { plan: "TRIAL", trialEndsAt: newTrialEndsAt } : {}),
      })
      .where(eq(businesses.id, business.id));

    if (createPaymentRequest && customPriceUzs > 0) {
      await tx
        .update(subscriptions)
        .set({ status: "CANCELLED" })
        .where(
          and(eq(subscriptions.businessId, business.id), eq(subscriptions.status, "PENDING")),
        );

      await tx.insert(subscriptions).values({
        businessId: business.id,
        providerId: providerUser.id,
        plan: "PRO",
        status: "PENDING",
        provider: "MANUAL",
        amount: customPriceUzs,
        currency: "UZS",
        customStaffLimit,
        customClientLimit,
        providerCommissionPercent: commissionPercent,
        providerPayoutAmount,
        startedAt: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        note: `Кастомная подписка от провайдера ${providerUser.name}: ${customStaffLimit} сотр., ${customClientLimit} людей, цена ${customPriceUzs.toLocaleString("ru-RU")} сум (на карту провайдера ${commissionPercent}% = ${providerPayoutAmount.toLocaleString("ru-RU")} сум)`,
      });
    }
  });

  await recordAuditLog({
    userId: providerUser.id,
    action: "provider.subscription_customized",
    entityType: "business",
    entityId: business.id,
    details: {
      providerName: providerUser.name,
      businessName: business.name,
      customStaffLimit,
      customClientLimit,
      trialDays: safeTrialDays,
      customPriceUzs,
      commissionPercent,
      providerPayoutAmount,
      createPaymentRequest,
    },
  });

  refreshAll();
  return {
    ok: true,
    message: `Параметры подписки «${business.name}» обновлены!`,
  };
}

/**
 * 6. Provider action: Update own personal card for 60% (or custom %) payouts.
 */
export async function providerUpdateCardAction(
  _prev: ProviderActionState,
  formData: FormData,
): Promise<ProviderActionState> {
  const session = await requireProvider();
  const payoutCard = String(formData.get("payoutCard") ?? "").trim().slice(0, 60) || null;

  const db = await getDb();
  await db.update(users).set({ payoutCard }).where(eq(users.id, session.id));

  await recordAuditLog({
    userId: session.id,
    action: "provider.card_updated",
    entityType: "user",
    entityId: session.id,
    details: { payoutCard },
  });

  refreshAll();
  return { ok: true, message: "Реквизиты карты для выплат сохранены" };
}
