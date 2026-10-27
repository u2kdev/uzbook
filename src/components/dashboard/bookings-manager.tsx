"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  Clock3,
  Copy,
  Loader2,
  Phone,
  Plus,
  Search,
  UserX,
  X,
} from "lucide-react";
import {
  createManualBookingAction,
  setBookingStatus,
  type ManualBookingState,
} from "@/server/actions/bookings";
import { formatMoney } from "@/lib/plans";

type BookingRow = {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  source: string;
  price: number;
  durationMin: number;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  note: string | null;
  manageToken: string;
  serviceId: string;
  serviceName: string;
  staffId: string;
  staffName: string;
  staffColor: string;
};

type StaffOption = { id: string; name: string; color: string; title: string | null };
type ServiceOption = { id: string; name: string; durationMin: number; price: number };

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber/10 text-amber",
  CONFIRMED: "bg-brand-soft text-brand-dark",
  COMPLETED: "bg-mint/10 text-mint",
  NO_SHOW: "bg-paper text-muted",
  CANCELLED: "bg-rose/10 text-rose",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Ждёт",
  CONFIRMED: "Подтверждена",
  COMPLETED: "Завершена",
  NO_SHOW: "Не пришёл",
  CANCELLED: "Отменена",
};

const SOURCE_LABEL: Record<string, string> = {
  WEB: "Онлайн",
  TELEGRAM: "Telegram",
  MANUAL: "Вручную",
};

function dateKey(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function timeLabel(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function dayLabel(iso: string, timezone: string, today: string) {
  const key = dateKey(iso, timezone);
  if (key === today) return "Сегодня";
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}

function durationLabel(minutes: number) {
  if (minutes < 60) return `${minutes} мин`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

export function BookingsManager({
  slug,
  timezone,
  currency,
  appUrl,
  today,
  bookings,
  services,
  staff,
}: {
  slug: string;
  timezone: string;
  currency: string;
  appUrl: string;
  today: string;
  bookings: BookingRow[];
  services: ServiceOption[];
  staff: StaffOption[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"upcoming" | "today" | "cancelled" | "all">("upcoming");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<BookingRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const now = Date.now();
    const search = query.trim().toLowerCase();
    return bookings
      .filter((booking) => {
        if (tab === "upcoming") {
          return (
            new Date(booking.endAt).getTime() >= now &&
            booking.status !== "CANCELLED"
          );
        }
        if (tab === "today") return dateKey(booking.startAt, timezone) === today;
        if (tab === "cancelled") return booking.status === "CANCELLED";
        return true;
      })
      .filter((booking) => {
        if (!search) return true;
        return (
          booking.clientName.toLowerCase().includes(search) ||
          booking.clientPhone.includes(search) ||
          booking.serviceName.toLowerCase().includes(search) ||
          booking.staffName.toLowerCase().includes(search)
        );
      })
      .sort((a, b) =>
        tab === "upcoming"
          ? new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
          : new Date(b.startAt).getTime() - new Date(a.startAt).getTime(),
      );
  }, [bookings, tab, query, timezone, today]);

  const groups = useMemo(() => {
    const map = new Map<string, BookingRow[]>();
    for (const booking of filtered) {
      const key = dateKey(booking.startAt, timezone);
      const list = map.get(key) ?? [];
      list.push(booking);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [filtered, timezone]);

  function act(booking: BookingRow, status: "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW") {
    startTransition(async () => {
      await setBookingStatus(booking.id, status);
      setSelected(null);
      router.refresh();
    });
  }

  const manageUrl = selected ? `${appUrl}/b/${selected.manageToken}` : "";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">
            Журнал
          </p>
          <h1 className="mt-1.5 text-[26px] leading-tight font-semibold tracking-[-0.03em]">
            Записи
          </h1>
          <p className="mt-1 text-[12.5px] text-muted">
            Все брони за последние 2 недели и вперёд. Клиент может перенести сам.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="btn btn-primary h-10 text-[12.5px]"
        >
          <Plus size={15} strokeWidth={1.8} /> Новая запись
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1 rounded-full border border-line bg-white p-1">
          {(
            [
              ["upcoming", "Предстоящие"],
              ["today", "Сегодня"],
              ["cancelled", "Отменённые"],
              ["all", "Все"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`rounded-full px-3 py-1.5 text-[11.5px] font-medium transition-colors ${
                tab === value ? "bg-ink text-white" : "text-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="ml-auto flex h-10 w-full items-center gap-2 rounded-full border border-line bg-white px-3.5 sm:w-64">
          <Search size={14} strokeWidth={1.7} className="text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Имя, телефон, услуга…"
            className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted/70"
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Очистить">
              <X size={13} className="text-muted" />
            </button>
          )}
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-line bg-white/60 px-6 py-14 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
            <CalendarDays size={20} strokeWidth={1.5} />
          </span>
          <p className="mt-4 text-[15px] font-semibold">
            {tab === "upcoming" ? "Впереди записей нет" : "Ничего не нашли"}
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-muted">
            Клиенты записываются по ссылке{" "}
            <span className="text-ink-soft">/{slug}</span>. Можно добавить запись вручную —
            например, по звонку.
          </p>
          <button onClick={() => setCreating(true)} className="btn btn-primary mt-5 h-10 text-[12.5px]">
            <Plus size={15} /> Добавить запись
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(([key, list]) => (
            <div key={key}>
              <div className="mb-2 flex items-center gap-2 px-1">
                <p className="text-[12px] font-semibold">{dayLabel(list[0].startAt, timezone, today)}</p>
                <span className="text-[11px] text-muted">
                  {list.length} {list.length === 1 ? "запись" : "записей"}
                </span>
              </div>

              <div className="overflow-hidden rounded-[20px] bg-white ring-1 ring-line/80">
                {list.map((booking, index) => (
                  <button
                    key={booking.id}
                    onClick={() => setSelected(booking)}
                    className={`flex w-full flex-wrap items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-paper/60 ${
                      index > 0 ? "border-t border-line/70" : ""
                    } ${booking.status === "CANCELLED" ? "opacity-60" : ""}`}
                  >
                    <div className="w-14 shrink-0">
                      <p className="text-[13px] font-semibold tabular-nums">
                        {timeLabel(booking.startAt, timezone)}
                      </p>
                      <p className="text-[10.5px] text-muted">
                        {durationLabel(booking.durationMin)}
                      </p>
                    </div>

                    <span
                      className="h-8 w-1 shrink-0 rounded-full"
                      style={{ background: booking.staffColor }}
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">
                        {booking.clientName}
                        {booking.status === "PENDING" && (
                          <span className="ml-2 rounded-full bg-amber/10 px-1.5 py-0.5 text-[9.5px] font-semibold text-amber">
                            ждёт
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-[11.5px] text-muted">
                        {booking.serviceName} · {booking.staffName}
                      </p>
                    </div>

                    <span className="hidden text-[11.5px] text-muted sm:block">
                      {SOURCE_LABEL[booking.source] ?? booking.source}
                    </span>

                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                        STATUS_STYLE[booking.status] ?? "bg-paper text-muted"
                      }`}
                    >
                      {STATUS_LABEL[booking.status] ?? booking.status}
                    </span>

                    <span className="w-20 text-right text-[12px] font-semibold tabular-nums">
                      {formatMoney(booking.price, currency)}
                    </span>
                    <ChevronRight size={14} className="text-muted/60" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Details */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <div className="w-full max-w-md rounded-t-[28px] bg-white p-5 shadow-lift sm:rounded-[28px] sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                    STATUS_STYLE[selected.status] ?? "bg-paper text-muted"
                  }`}
                >
                  {STATUS_LABEL[selected.status] ?? selected.status}
                </span>
                <h2 className="mt-3 text-[19px] leading-tight font-semibold">
                  {selected.clientName}
                </h2>
                <p className="mt-1 text-[12px] text-muted">
                  {selected.serviceName} · {selected.staffName}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="grid size-8 place-items-center rounded-lg bg-paper text-muted hover:text-ink"
                aria-label="Закрыть"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 rounded-xl bg-paper px-3.5 py-3">
              <p className="text-[12.5px] font-semibold">
                {new Intl.DateTimeFormat("ru-RU", {
                  timeZone: timezone,
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                }).format(new Date(selected.startAt))}
              </p>
              <p className="mt-0.5 text-[12px] text-muted">
                {timeLabel(selected.startAt, timezone)} — {timeLabel(selected.endAt, timezone)} ·{" "}
                {durationLabel(selected.durationMin)} · {formatMoney(selected.price, currency)}
              </p>
            </div>

            <div className="mt-3 space-y-2">
              <a
                href={`tel:${selected.clientPhone}`}
                className="flex items-center gap-2.5 rounded-xl border border-line px-3.5 py-2.5 text-[12.5px] font-medium hover:bg-paper"
              >
                <Phone size={14} strokeWidth={1.7} className="text-muted" />
                {selected.clientPhone}
              </a>
              {selected.note && (
                <div className="rounded-xl border border-line px-3.5 py-2.5 text-[12px] leading-relaxed text-muted">
                  {selected.note}
                </div>
              )}
              <button
                onClick={() => navigator.clipboard.writeText(manageUrl)}
                className="flex w-full items-center gap-2.5 rounded-xl border border-line px-3.5 py-2.5 text-left text-[12.5px] hover:bg-paper"
              >
                <Copy size={14} strokeWidth={1.7} className="text-muted" />
                <span className="flex-1 truncate">Ссылка для клиента</span>
                <span className="text-[11px] text-brand-dark">копировать</span>
              </button>
              <Link
                href={`/b/${selected.manageToken}`}
                target="_blank"
                className="flex items-center gap-2.5 rounded-xl border border-line px-3.5 py-2.5 text-[12.5px] hover:bg-paper"
              >
                <ArrowUpRight size={14} strokeWidth={1.7} className="text-muted" />
                Открыть страницу записи
              </Link>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              {selected.status === "PENDING" && (
                <button
                  onClick={() => act(selected, "CONFIRMED")}
                  disabled={pending}
                  className="btn btn-accent col-span-2 h-10 text-[12px]"
                >
                  {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Подтвердить
                </button>
              )}
              {selected.status === "CONFIRMED" && (
                <>
                  <button
                    onClick={() => act(selected, "COMPLETED")}
                    disabled={pending}
                    className="btn btn-primary h-10 text-[12px]"
                  >
                    <CheckCheck size={14} /> Пришёл
                  </button>
                  <button
                    onClick={() => act(selected, "NO_SHOW")}
                    disabled={pending}
                    className="btn btn-ghost h-10 text-[12px]"
                  >
                    <UserX size={14} /> Не пришёл
                  </button>
                </>
              )}
              {selected.status !== "CANCELLED" && selected.status !== "COMPLETED" && (
                <button
                  onClick={() => act(selected, "CANCELLED")}
                  disabled={pending}
                  className="btn btn-ghost col-span-2 h-10 border-rose/20 text-[12px] text-rose hover:bg-rose/5"
                >
                  Отменить запись
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {creating && (
        <ManualBookingModal
          slug={slug}
          timezone={timezone}
          currency={currency}
          appUrl={appUrl}
          today={today}
          services={services}
          staff={staff}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Manual booking                                                      */
/* ------------------------------------------------------------------ */

type Slot = { start: string; label: string };

function ManualBookingModal({
  slug,
  timezone,
  currency,
  appUrl,
  today,
  services,
  staff,
  onClose,
}: {
  slug: string;
  timezone: string;
  currency: string;
  appUrl: string;
  today: string;
  services: ServiceOption[];
  staff: StaffOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ManualBookingState, FormData>(
    createManualBookingAction,
    null,
  );
  const [staffId, setStaffId] = useState(staff[0]?.id ?? "");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [date, setDate] = useState(today);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [startAt, setStartAt] = useState("");

  useEffect(() => {
    if (!staffId || !serviceId || !date) {
      setSlots([]);
      return;
    }
    const controller = new AbortController();
    setLoadingSlots(true);
    setStartAt("");
    fetch(
      `/api/public/${encodeURIComponent(slug)}/availability?staffId=${staffId}&serviceId=${serviceId}&date=${date}`,
      { signal: controller.signal },
    )
      .then((response) => (response.ok ? response.json() : { slots: [] }))
      .then((data: { slots?: Slot[] }) => setSlots(data.slots ?? []))
      .catch(() => {
        if (!controller.signal.aborted) setSlots([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingSlots(false);
      });
    return () => controller.abort();
  }, [slug, staffId, serviceId, date]);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state?.ok, router]);

  const service = services.find((item) => item.id === serviceId);
  const createdUrl = state?.bookingToken ? `${appUrl}/b/${state.bookingToken}` : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-lift sm:rounded-[28px] sm:p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[18px] font-semibold">Новая запись</h2>
            <p className="mt-0.5 text-[12px] text-muted">Например, клиент позвонил или написал в Instagram.</p>
          </div>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg bg-paper text-muted hover:text-ink"
            aria-label="Закрыть"
          >
            <X size={16} />
          </button>
        </div>

        {createdUrl ? (
          <div className="mt-6 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-mint/10 text-mint">
              <Check size={22} strokeWidth={2} />
            </span>
            <p className="mt-3 text-[15px] font-semibold">Запись создана</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">
              Клиент может отменить или перенести её по ссылке — отправьте её ему.
            </p>
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2.5">
              <span className="truncate text-[11.5px]">{createdUrl}</span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(createdUrl)}
                className="ml-auto shrink-0 text-[11px] font-semibold text-brand-dark"
              >
                копировать
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={onClose} className="btn btn-ghost h-10 text-[12px]">
                Закрыть
              </button>
              <Link href={`/b/${state?.bookingToken}`} target="_blank" className="btn btn-primary h-10 text-[12px]">
                Открыть
              </Link>
            </div>
          </div>
        ) : (
          <form action={formAction} className="mt-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="manual-staff" className="label-base">
                  Мастер
                </label>
                <select
                  id="manual-staff"
                  name="staffId"
                  className="input-base"
                  value={staffId}
                  onChange={(event) => setStaffId(event.target.value)}
                  required
                >
                  {staff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                      {member.title ? ` · ${member.title}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="manual-service" className="label-base">
                  Услуга
                </label>
                <select
                  id="manual-service"
                  name="serviceId"
                  className="input-base"
                  value={serviceId}
                  onChange={(event) => setServiceId(event.target.value)}
                  required
                >
                  {services.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {formatMoney(item.price, currency)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="manual-date" className="label-base">
                Дата
              </label>
              <input
                id="manual-date"
                type="date"
                min={today}
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="input-base"
              />
            </div>

            <div>
              <span className="label-base flex items-center gap-2">
                Время
                {service && (
                  <span className="font-normal normal-case text-muted">
                    · {durationLabel(service.durationMin)}
                  </span>
                )}
              </span>
              {loadingSlots ? (
                <div className="flex h-[72px] items-center justify-center rounded-xl border border-line">
                  <Loader2 size={16} className="animate-spin text-muted" />
                </div>
              ) : slots.length === 0 ? (
                <div className="flex h-[72px] items-center justify-center rounded-xl border border-dashed border-line px-4 text-center text-[11.5px] text-muted">
                  Свободных слотов нет — выберите другой день или мастера.
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                  {slots.map((slot) => (
                    <button
                      key={slot.start}
                      type="button"
                      onClick={() => setStartAt(slot.start)}
                      className={`rounded-lg border py-2 text-[11.5px] font-medium transition-colors ${
                        startAt === slot.start
                          ? "border-ink bg-ink text-white"
                          : "border-line bg-white text-ink-soft hover:border-ink/25"
                      }`}
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
              )}
              <input type="hidden" name="startAt" value={startAt} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="manual-name" className="label-base">
                  Имя клиента
                </label>
                <input id="manual-name" name="name" className="input-base" placeholder="Лола" required />
              </div>
              <div>
                <label htmlFor="manual-phone" className="label-base">
                  Телефон
                </label>
                <input
                  id="manual-phone"
                  name="phone"
                  className="input-base"
                  placeholder="+998 90 000 00 00"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="manual-note" className="label-base">
                Заметка <span className="font-normal normal-case text-muted">(необязательно)</span>
              </label>
              <input id="manual-note" name="note" className="input-base" placeholder="Пожелания клиента" />
            </div>

            {(state?.error || !startAt) && (
              <p className={`text-[11.5px] ${state?.error ? "text-rose" : "text-muted"}`}>
                {state?.error ?? "Выберите свободное время"}
              </p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button type="button" onClick={onClose} className="btn btn-ghost h-11 flex-1 text-[12.5px]">
                Отмена
              </button>
              <button
                type="submit"
                disabled={pending || !startAt}
                className="btn btn-primary h-11 flex-[1.4] text-[12.5px]"
              >
                {pending ? <Loader2 size={15} className="animate-spin" /> : <CalendarDays size={15} />}
                Создать запись
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
