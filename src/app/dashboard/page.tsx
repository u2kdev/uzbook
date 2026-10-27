import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, CircleDollarSign, Gauge, Plus, TriangleAlert } from "lucide-react";
import { addDays, humanDate, todayInZone } from "@/server/booking/time";
import { getDaySchedule, dayStats } from "@/server/business/day";
import { getMyBusiness } from "@/server/auth/session";
import { DayTimeline } from "@/components/dashboard/timeline";
import { CopyLink } from "@/components/dashboard/copy-link";
import { formatMoney } from "@/lib/plans";
import { getOwnerServices } from "@/server/business/public";

import { QuickActions } from "@/components/dashboard/quick-actions";

export const dynamic = "force-dynamic";

function capitalize(input: string) {
  return input.charAt(0).toUpperCase() + input.slice(1);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { business } = await getMyBusiness();
  if (!business) return null;

  const params = await searchParams;
  const timezone = business.timezone;
  const today = todayInZone(timezone);
  const date =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today;

  const [schedule, services] = await Promise.all([
    getDaySchedule(business, date),
    getOwnerServices(business.id),
  ]);
  const stats = dayStats(business, schedule);
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const publicUrl = `${appUrl}/${business.slug}`;

  const hoursRecord: Record<string, { startMinute: number; endMinute: number }[]> = {};
  for (const [staffId, list] of schedule.hoursByStaff) hoursRecord[staffId] = list;

  const timelineBookings = schedule.bookings.map((b) => ({
    ...b,
    startAt: b.startAt.toISOString(),
    endAt: b.endAt.toISOString(),
  }));

  const dateLabel = date === today ? "Сегодня" : capitalize(humanDate(date, timezone));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">
            Обзор дня
          </p>
          <h1 className="mt-1.5 text-[28px] leading-tight font-semibold tracking-[-0.03em]">
            {dateLabel}
          </h1>
          <p className="mt-1 text-[12.5px] text-muted">
            {capitalize(humanDate(date, timezone))} · {business.timezone}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-full border border-line bg-white p-1">
            <Link
              href={`/dashboard?date=${addDays(date, -1)}`}
              className="grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-paper hover:text-ink"
              aria-label="Предыдущий день"
            >
              <ArrowLeft size={15} strokeWidth={1.7} />
            </Link>
            <Link
              href="/dashboard"
              className="px-2.5 text-[12px] font-medium text-ink-soft hover:text-ink"
            >
              Сегодня
            </Link>
            <Link
              href={`/dashboard?date=${addDays(date, 1)}`}
              className="grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-paper hover:text-ink"
              aria-label="Следующий день"
            >
              <ArrowRight size={15} strokeWidth={1.7} />
            </Link>
          </div>

          <QuickActions
            staff={schedule.staff.map((s) => ({ id: s.id, name: s.name }))}
            date={date}
          />
        </div>
      </div>

      {/* Late arrivals alert */}
      {stats.late > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber/30 bg-amber/10 px-4 py-3 text-amber">
          <TriangleAlert size={18} className="shrink-0" />
          <div className="text-[12.5px]">
            <span className="font-semibold">{stats.late} {stats.late === 1 ? "клиент опаздывает" : "клиента опаздывают"} прямо сейчас.</span>{" "}
            Проверьте таймлайн и свяжитесь с клиентом по телефону.
          </div>
        </div>
      )}

      {services.length === 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber/25 bg-amber/5 px-4 py-3.5">
          <TriangleAlert size={17} strokeWidth={1.6} className="text-amber" />
          <p className="flex-1 text-[12.5px] text-ink-soft">
            Пока нет ни одной услуги — клиенты не смогут записаться. Добавьте хотя бы одну.
          </p>
          <Link href="/dashboard/services" className="btn btn-ghost h-9 text-[12px]">
            Добавить услугу
          </Link>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Записей на день",
            value: String(stats.count),
            hint: `${stats.confirmed} подтв. · ${stats.completed} заверш. · ${stats.noShow} неявок`,
            icon: CalendarDays,
          },
          {
            label: "Свободные окна",
            value: `${Math.round(stats.freeMinutes / 60)} ч`,
            hint: `${stats.load}% загрузка (${Math.round(stats.bookedMinutes / 60)} ч занято)`,
            icon: Gauge,
          },
          {
            label: "Ожидаемая выручка",
            value: formatMoney(stats.revenue, business.currency),
            hint: `Факт: ${formatMoney(stats.actualRevenue, business.currency)}`,
            icon: CircleDollarSign,
          },
          {
            label: "Мастеров",
            value: String(schedule.staff.length),
            hint: schedule.staff.length ? "в графике на день" : "добавьте команду",
            icon: CalendarDays,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl bg-white p-4 ring-1 ring-line/80 transition-shadow duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:shadow-soft"
          >
            <div className="flex items-center justify-between">
              <p className="text-[11.5px] font-medium text-muted">{card.label}</p>
              <card.icon size={15} strokeWidth={1.5} className="text-muted/60" />
            </div>
            <p className="mt-2 truncate text-[24px] leading-none font-semibold tracking-[-0.03em]">
              {card.value}
            </p>
            <p className="mt-1.5 text-[11px] text-muted">{card.hint}</p>
          </div>
        ))}
      </div>

      {/* Status breakdown bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-3 ring-1 ring-line/80 text-[12px]">
        <span className="text-[11px] font-medium text-muted uppercase tracking-wider px-1">Статусы:</span>
        <span className="rounded-full bg-paper px-2.5 py-1 font-medium">Всего: {stats.totalBookings}</span>
        <span className="rounded-full bg-brand/10 text-brand px-2.5 py-1 font-medium">Подтверждено: {stats.confirmed}</span>
        <span className="rounded-full bg-mint/10 text-mint px-2.5 py-1 font-medium">Пришёл: {stats.completed}</span>
        {stats.noShow > 0 && <span className="rounded-full bg-rose/10 text-rose px-2.5 py-1 font-medium">Не пришёл: {stats.noShow}</span>}
        {stats.cancelled > 0 && <span className="rounded-full bg-paper text-muted px-2.5 py-1 font-medium">Отменено: {stats.cancelled}</span>}
        {stats.pending > 0 && <span className="rounded-full bg-amber/10 text-amber px-2.5 py-1 font-medium">Ждёт подтверждения: {stats.pending}</span>}
      </div>

      <div className="rounded-[24px] bg-white p-4 ring-1 ring-line/80 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-semibold">Таймлайн</h2>
            <p className="text-[11.5px] text-muted">Нажмите на запись, чтобы открыть детали</p>
          </div>
          <div className="hidden items-center gap-3 text-[10.5px] text-muted sm:flex">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-brand" /> подтверждена
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-amber" /> ждёт
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-mint" /> пришёл
            </span>
          </div>
        </div>

        {stats.count === 0 && schedule.staff.length > 0 && (
          <div className="mb-4 rounded-xl border border-dashed border-line bg-paper/50 p-3.5 text-center text-[12px] text-muted">
            На этот день пока нет записей. Создайте запись вручную по кнопке «Новая запись» или отправьте ссылку на запись клиентам.
          </div>
        )}

        <DayTimeline
          staff={schedule.staff.map((s) => ({
            id: s.id,
            name: s.name,
            color: s.color,
            title: s.title,
          }))}
          bookings={timelineBookings}
          hours={hoursRecord}
          timezone={timezone}
          currency={business.currency}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <CopyLink url={publicUrl} />
        <Link
          href={`/${business.slug}`}
          target="_blank"
          className="group flex items-center justify-between rounded-2xl bg-ink px-5 py-4 text-white transition-shadow duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:shadow-lift"
        >
          <div>
            <p className="text-[13px] font-semibold">Открыть страницу салона</p>
            <p className="mt-0.5 text-[11.5px] text-white/50">Так её видят клиенты</p>
          </div>
          <span className="grid size-9 place-items-center rounded-full bg-white/10 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-1 group-hover:-translate-y-px">
            <ArrowRight size={15} strokeWidth={1.6} />
          </span>
        </Link>
      </div>
    </div>
  );
}
