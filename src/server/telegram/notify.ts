import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { bookings, businesses, services, staff, users } from "@/server/db/schema";
import { dateInZone } from "@/server/booking/time";

/* ------------------------------------------------------------------ */
/* Low-level Bot API                                                   */
/* ------------------------------------------------------------------ */

type InlineButton = { text: string; url: string };

function botToken() {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
}

export function telegramConfigured() {
  return botToken().length > 0;
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendTelegramMessage(
  chatId: string,
  text: string,
  buttons?: InlineButton[][],
): Promise<boolean> {
  const token = botToken();
  if (!token) return false;

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...(buttons?.length
          ? { reply_markup: { inline_keyboard: buttons } }
          : {}),
      }),
      cache: "no-store",
    });
    return response.ok;
  } catch (error) {
    console.error("telegram sendMessage failed", error);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Booking notifications                                               */
/* ------------------------------------------------------------------ */

function appUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function formatWhen(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString("ru-RU")} ${currency}`;
  }
}

type BookingContext = Awaited<ReturnType<typeof loadBookingContext>>;

async function loadBookingContext(bookingId: string) {
  const db = await getDb();
  const [row] = await db
    .select({
      booking: bookings,
      serviceName: services.name,
      staffName: staff.name,
      business: businesses,
      ownerTelegramId: users.telegramId,
    })
    .from(bookings)
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .innerJoin(staff, eq(bookings.staffId, staff.id))
    .innerJoin(businesses, eq(bookings.businessId, businesses.id))
    .innerJoin(users, eq(businesses.ownerId, users.id))
    .where(eq(bookings.id, bookingId))
    .limit(1);
  return row ?? null;
}

function ownerButtons(ctx: BookingContext) {
  if (!ctx) return undefined;
  const date = dateInZone(ctx.booking.startAt, ctx.business.timezone);
  return [
    [
      {
        text: "Открыть кабинет",
        url: `${appUrl()}/dashboard/bookings?date=${date}`,
      },
      {
        text: "Страница записи",
        url: `${appUrl()}/${ctx.business.slug}`,
      },
    ],
  ];
}

function bookingCard(ctx: NonNullable<BookingContext>, title: string) {
  const { booking, business } = ctx;
  const price = business.settings.showPrices
    ? `\n💰 ${formatMoney(booking.price, business.currency)}`
    : "";
  const note = booking.note ? `\n\n📝 ${escapeHtml(booking.note)}` : "";
  const status =
    booking.status === "PENDING" ? "\n\n⏳ Ждёт подтверждения" : "";

  return [
    `<b>${title}</b>`,
    "",
    `👤 ${escapeHtml(booking.clientName)} · <a href="tel:${escapeHtml(booking.clientPhone)}">${escapeHtml(booking.clientPhone)}</a>`,
    `💼 ${escapeHtml(ctx.serviceName)} · ${escapeHtml(ctx.staffName)}`,
    `🗓 ${formatWhen(booking.startAt, business.timezone)}${price}`,
    note,
    status,
  ].join("\n");
}

/** Fire-and-forget: tells the owner about a new booking in Telegram. */
export async function notifyNewBooking(bookingId: string) {
  try {
    const ctx = await loadBookingContext(bookingId);
    if (!ctx?.ownerTelegramId) return;
    await sendTelegramMessage(
      ctx.ownerTelegramId,
      bookingCard(ctx, `Новая запись · ${escapeHtml(ctx.business.name)}`),
      ownerButtons(ctx),
    );
  } catch (error) {
    console.error("notifyNewBooking failed", error);
  }
}

export async function notifyBookingCancelled(bookingId: string) {
  try {
    const ctx = await loadBookingContext(bookingId);
    if (!ctx?.ownerTelegramId) return;
    await sendTelegramMessage(
      ctx.ownerTelegramId,
      bookingCard(ctx, `Клиент отменил запись · ${escapeHtml(ctx.business.name)}`),
      ownerButtons(ctx),
    );
  } catch (error) {
    console.error("notifyBookingCancelled failed", error);
  }
}

export async function notifyBookingRescheduled(bookingId: string) {
  try {
    const ctx = await loadBookingContext(bookingId);
    if (!ctx?.ownerTelegramId) return;
    await sendTelegramMessage(
      ctx.ownerTelegramId,
      bookingCard(ctx, `Запись перенесена · ${escapeHtml(ctx.business.name)}`),
      ownerButtons(ctx),
    );
  } catch (error) {
    console.error("notifyBookingRescheduled failed", error);
  }
}
