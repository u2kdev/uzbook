import { Bot, InlineKeyboard } from "grammy";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { businesses, users, bookings, subscriptions } from "@/server/db/schema";
import { getDaySchedule } from "@/server/business/day";
import { todayInZone } from "@/server/booking/time";
import { readTelegramLinkToken } from "@/server/telegram/link";
import { completePayment, getPaymentByExternalId } from "@/server/payments/service";
import { planById } from "@/lib/plans";
import { isUpdateProcessed, markUpdateProcessed } from "@/server/telegram/idempotency";

const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

function timeLabel(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function ownerKeyboard(slug?: string | null) {
  const isHttps = appUrl.startsWith("https://");
  const kb = new InlineKeyboard();
  if (isHttps) {
    kb.webApp("Кабинет (Mini App)", `${appUrl}/dashboard?tma=1`);
    if (slug) {
      kb.row().webApp("Страница записи", `${appUrl}/${slug}?tma=1`);
    }
  } else {
    kb.url("Открыть кабинет", `${appUrl}/dashboard`);
    if (slug) {
      kb.row().url("Страница записи", `${appUrl}/${slug}`);
    }
  }
  return kb;
}

export async function ownerBusiness(telegramId: string) {
  const db = await getDb();
  const [business] = await db
    .select()
    .from(businesses)
    .innerJoin(users, eq(businesses.ownerId, users.id))
    .where(eq(users.telegramId, telegramId))
    .limit(1);
  return business?.businesses ?? null;
}

export async function getUserByTelegramId(telegramId: string) {
  const db = await getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.telegramId, telegramId))
    .limit(1);
  return user ?? null;
}

export function initBotInstance(token: string) {
  const bot = new Bot(token);

  // 1. Idempotency middleware: deduplicate retried update_id
  bot.use(async (ctx, next) => {
    const updateId = ctx.update?.update_id;
    if (typeof updateId === "number") {
      if (isUpdateProcessed(updateId)) {
        return;
      }
      markUpdateProcessed(updateId);
    }
    await next();
  });

  // 2. /start command
  bot.command("start", async (ctx) => {
    if (!ctx.from) return;
    const payload = ctx.match?.trim() ?? "";

    if (payload.startsWith("link_")) {
      const link = await readTelegramLinkToken(payload.slice(5));
      if (!link) {
        await ctx.reply(
          "Ссылка для привязки недействительна или устарела. Откройте кабинет → «Страница» и получите новую.",
        );
        return;
      }

      const db = await getDb();
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, link.userId))
        .limit(1);
      if (!user) {
        await ctx.reply("Аккаунт не найден. Возможно, он был удалён.");
        return;
      }

      try {
        await db
          .update(users)
          .set({ telegramId: String(ctx.from.id) })
          .where(eq(users.id, user.id));
      } catch {
        await ctx.reply(
          "Этот Telegram уже привязан к другому аккаунту uzbook. Отвяжите его в старом кабинете или напишите в поддержку.",
        );
        return;
      }

      const business = await ownerBusiness(String(ctx.from.id));
      await ctx.reply(
        `Готово, ${user.name}! Уведомления о новых записях будут приходить сюда.\n\nКоманды:\n/today — записи на сегодня\n/app — открыть Mini App\n/help — помощь\n/unlink — отвязать Telegram`,
        { reply_markup: ownerKeyboard(business?.slug) },
      );
      return;
    }

    if (payload.startsWith("book_")) {
      const slug = payload.slice(5).trim();
      const db = await getDb();
      const [biz] = await db.select().from(businesses).where(eq(businesses.slug, slug)).limit(1);
      if (biz) {
        const isHttps = appUrl.startsWith("https://");
        const kb = new InlineKeyboard();
        if (isHttps) {
          kb.webApp("Записаться онлайн", `${appUrl}/${biz.slug}?tma=1`);
        } else {
          kb.url("Записаться онлайн", `${appUrl}/${biz.slug}`);
        }
        await ctx.reply(
          `Онлайн-запись в «${biz.name}»:\nНажмите кнопку ниже, чтобы выбрать услугу, мастера и время.`,
          { reply_markup: kb },
        );
        return;
      }
    }

    if (payload.startsWith("booking_")) {
      const token = payload.slice(8).trim();
      const isHttps = appUrl.startsWith("https://");
      const kb = new InlineKeyboard();
      if (isHttps) {
        kb.webApp("Управление записью", `${appUrl}/b/${token}?tma=1`);
      } else {
        kb.url("Управление записью", `${appUrl}/b/${token}`);
      }
      await ctx.reply(
        "Управление вашей записью в uzbook:\nНажмите кнопку ниже, чтобы посмотреть подробности, перенести или отменить запись.",
        { reply_markup: kb },
      );
      return;
    }

    const business = await ownerBusiness(String(ctx.from.id));
    if (business) {
      await ctx.reply(
        `С возвращением! Это бот uzbook.\n\n/today — записи на сегодня\n/app — открыть Mini App\n/help — помощь\n/unlink — отвязать Telegram`,
        { reply_markup: ownerKeyboard(business.slug) },
      );
      return;
    }

    await ctx.reply(
      [
        "Это бот uzbook — онлайн-запись для салонов, барбершопов и мастеров.",
        "",
        "Чтобы получать уведомления о записях, откройте кабинет → «Страница» → «Подключить Telegram».",
        "",
        `Кабинет: ${appUrl}/dashboard`,
      ].join("\n"),
    );
  });

  // 3. /app command
  bot.command("app", async (ctx) => {
    if (!ctx.from) return;
    const business = await ownerBusiness(String(ctx.from.id));
    const isHttps = appUrl.startsWith("https://");
    const kb = new InlineKeyboard();
    if (business) {
      if (isHttps) {
        kb.webApp("Открыть кабинет", `${appUrl}/dashboard?tma=1`);
        kb.row().webApp("Страница записи", `${appUrl}/${business.slug}?tma=1`);
      } else {
        kb.url("Открыть кабинет", `${appUrl}/dashboard`);
        kb.row().url("Страница записи", `${appUrl}/${business.slug}`);
      }
      await ctx.reply(`Mini App uzbook для «${business.name}»:`, { reply_markup: kb });
    } else {
      if (isHttps) {
        kb.webApp("Открыть uzbook", `${appUrl}?tma=1`);
      } else {
        kb.url("Открыть uzbook", appUrl);
      }
      await ctx.reply("Открыть uzbook в Telegram Mini App:", { reply_markup: kb });
    }
  });

  // 4. /today command
  bot.command("today", async (ctx) => {
    if (!ctx.from) return;
    const business = await ownerBusiness(String(ctx.from.id));
    if (!business) {
      await ctx.reply(
        "Не вижу ваш бизнес. Войдите в кабинет и создайте страницу, затем привяжите Telegram заново.",
        { reply_markup: ownerKeyboard() },
      );
      return;
    }

    const date = todayInZone(business.timezone);
    const schedule = await getDaySchedule(business, date);
    const active = schedule.bookings.filter(
      (booking) => booking.status !== "CANCELLED" && booking.status !== "NO_SHOW",
    );

    if (active.length === 0) {
      await ctx.reply(
        `На сегодня (${date}) записей нет.\n\n${appUrl}/${business.slug}`,
        {
          reply_markup: new InlineKeyboard().url(
            "Открыть таймлайн",
            `${appUrl}/dashboard?date=${date}`,
          ),
        },
      );
      return;
    }

    const revenue = active.reduce((sum, booking) => sum + booking.price, 0);
    const lines = active
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
      .map((booking) => {
        const time = timeLabel(booking.startAt, business.timezone);
        const status = booking.status === "PENDING" ? " · ⏳" : "";
        return `${time} — ${booking.clientName} · ${booking.serviceName} (${booking.staffName})${status}`;
      });

    await ctx.reply(
      [
        `📅 ${business.name} · ${date}`,
        "",
        ...lines,
        "",
        `Записей: ${active.length} · ${money(revenue, business.currency)}`,
      ].join("\n"),
      {
        reply_markup: new InlineKeyboard().url(
          "Открыть таймлайн",
          `${appUrl}/dashboard?date=${date}`,
        ),
      },
    );
  });

  // 5. /help command
  bot.command("help", async (ctx) => {
    const business = ctx.from ? await ownerBusiness(String(ctx.from.id)) : null;
    await ctx.reply(
      [
        "uzbook — онлайн-запись клиентов без переписок и звонков.",
        "",
        "Доступные команды:",
        "• /today — список записей и ожидаемая выручка на сегодня",
        "• /app — открыть Telegram Mini App (кабинет или запись)",
        "• /help — список возможностей и контакты поддержки",
        "• /unlink — отвязать Telegram от кабинета uzbook",
        "",
        "Уведомления приходят автоматически при:",
        "✓ новой записи клиента",
        "✓ отмене или переносе времени",
        "✓ подтверждении тарифа или напоминании об окончании",
        "",
        `Поддержка: hello@uzbook.online`,
      ].join("\n"),
      { reply_markup: ownerKeyboard(business?.slug) },
    );
  });

  // 6. /unlink command
  bot.command("unlink", async (ctx) => {
    if (!ctx.from) return;
    const db = await getDb();
    await db
      .update(users)
      .set({ telegramId: null })
      .where(eq(users.telegramId, String(ctx.from.id)));

    await ctx.reply(
      "Ваш Telegram-аккаунт успешно отвязан от uzbook. Чтобы подключить его снова, откройте страницу салона в кабинете и нажмите «Подключить Telegram».",
      { reply_markup: ownerKeyboard() },
    );
  });

  // 7. /stats command (ADMIN only)
  bot.command("stats", async (ctx) => {
    if (!ctx.from) return;
    const user = await getUserByTelegramId(String(ctx.from.id));
    if (user?.role !== "ADMIN") {
      await ctx.reply("Команда доступна только администраторам платформы uzbook.");
      return;
    }

    const db = await getDb();
    const [bizCount] = await db.select({ count: sql<number>`count(*)` }).from(businesses);
    const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const [activeSubCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(subscriptions)
      .where(eq(subscriptions.status, "ACTIVE"));

    await ctx.reply(
      [
        "📊 Статистика платформы uzbook (ADMIN):",
        "",
        `• Бизнесов: ${bizCount?.count ?? 0}`,
        `• Пользователей: ${userCount?.count ?? 0}`,
        `• Активных подписок: ${activeSubCount?.count ?? 0}`,
        `• Статус системы: OK (healthy)`,
        "",
        `Панель администратора: ${appUrl}/admin`,
      ].join("\n"),
    );
  });

  // 8. Stars payments
  bot.on("pre_checkout_query", async (ctx) => {
    const payload = ctx.preCheckoutQuery.invoice_payload;
    const row = await getPaymentByExternalId(payload);

    if (!row || row.payment.provider !== "TELEGRAM_STARS") {
      await ctx.answerPreCheckoutQuery(false, {
        error_message: "Счёт не найден. Создайте новый в разделе «Оплата».",
      });
      return;
    }
    if (row.payment.status === "PAID") {
      await ctx.answerPreCheckoutQuery(false, {
        error_message: "Этот счёт уже оплачен.",
      });
      return;
    }
    if (row.payment.status === "CANCELLED" || row.payment.status === "FAILED") {
      await ctx.answerPreCheckoutQuery(false, {
        error_message: "Счёт отменён. Создайте новый в разделе «Оплата».",
      });
      return;
    }

    await ctx.answerPreCheckoutQuery(true);
  });

  bot.on("message:successful_payment", async (ctx) => {
    const success = ctx.message.successful_payment;
    const result = await completePayment({
      externalId: success.invoice_payload,
      providerTxnId: success.telegram_payment_charge_id,
      payload: {
        telegram_charge_id: success.telegram_payment_charge_id,
        telegram_provider_charge_id: success.provider_payment_charge_id,
        stars_amount: success.total_amount,
        stars_currency: success.currency,
      },
    });

    if (!result.ok) {
      await ctx.reply(
        `Оплата получена, но тариф не включился автоматически: ${result.error}.\nНапишите в поддержку — проверим вручную.`,
      );
      return;
    }

    const plan = planById(result.payment.plan);
    await ctx.reply(
      `⭐ Оплата получена. Тариф «${plan.name}» подключён до ${new Intl.DateTimeFormat(
        "ru-RU",
        { day: "numeric", month: "long", year: "numeric" },
      ).format(result.periodEnd)}.`,
      { reply_markup: ownerKeyboard() },
    );
  });

  // 9. Structured error logging
  bot.catch((err) => {
    const updateId = err.ctx?.update?.update_id;
    console.error(
      JSON.stringify({
        level: "error",
        event: "telegram_bot_error",
        time: new Date().toISOString(),
        updateId,
        message: err.message,
        stack: err.stack,
      }),
    );
  });

  return bot;
}
