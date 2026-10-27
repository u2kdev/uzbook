import { Bot, InlineKeyboard } from "grammy";
import { eq } from "drizzle-orm";
import { getDb } from "../src/server/db";
import { businesses, users } from "../src/server/db/schema";
import { getDaySchedule } from "../src/server/business/day";
import { todayInZone } from "../src/server/booking/time";
import { readTelegramLinkToken } from "../src/server/telegram/link";
import { completePayment, getPaymentByExternalId } from "../src/server/payments/service";
import { planById } from "../src/lib/plans";

try {
  process.loadEnvFile?.(".env");
} catch {
  /* .env is optional */
}

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

if (!token) {
  console.error(
    "TELEGRAM_BOT_TOKEN не задан. Добавьте токен от @BotFather в .env и запустите `npm run bot` снова.",
  );
  process.exit(1);
}

const bot = new Bot(token);

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

function cabinetKeyboard() {
  return new InlineKeyboard().url("Открыть кабинет", `${appUrl}/dashboard`);
}

async function ownerBusiness(telegramId: string) {
  const db = await getDb();
  const [business] = await db
    .select()
    .from(businesses)
    .innerJoin(users, eq(businesses.ownerId, users.id))
    .where(eq(users.telegramId, telegramId))
    .limit(1);
  return business?.businesses ?? null;
}

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

    await ctx.reply(
      `Готово, ${user.name}! Уведомления о новых записях будут приходить сюда.\n\nКоманды:\n/today — записи на сегодня\n/help — помощь`,
      { reply_markup: cabinetKeyboard() },
    );
    return;
  }

  const business = await ownerBusiness(String(ctx.from.id));
  if (business) {
    await ctx.reply(
      `С возвращением! Это бот uzbook.\n\n/today — записи на сегодня\n/help — помощь`,
      { reply_markup: cabinetKeyboard() },
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

bot.command("today", async (ctx) => {
  if (!ctx.from) return;
  const business = await ownerBusiness(String(ctx.from.id));
  if (!business) {
    await ctx.reply(
      "Не вижу ваш бизнес. Войдите в кабинет и создайте страницу, затем привяжите Telegram заново.",
      { reply_markup: cabinetKeyboard() },
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
      { reply_markup: new InlineKeyboard().url("Открыть таймлайн", `${appUrl}/dashboard?date=${date}`) },
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

bot.command("help", async (ctx) => {
  await ctx.reply(
    [
      "uzbook — запись клиентов без переписок.",
      "",
      "Что умеет бот:",
      "• присылает уведомление о новой записи, отмене и переносе;",
      "• /today — короткая сводка на сегодня;",
      "• ссылка на кабинет и страницу записи.",
      "",
      `Страница записи: ${appUrl}`,
      `Поддержка: hello@uzbook.online`,
    ].join("\n"),
    { reply_markup: cabinetKeyboard() },
  );
});

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
    { reply_markup: cabinetKeyboard() },
  );
});

bot.catch((error) => {
  console.error("bot error", error.error);
});

async function main() {
  await bot.api.setMyCommands([
    { command: "today", description: "Записи на сегодня" },
    { command: "help", description: "Помощь" },
  ]);

  console.log("uzbook bot started (long polling)");
  await bot.start();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
