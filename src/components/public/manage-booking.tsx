"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  Loader2,
  MapPin,
  RotateCcw,
  Scissors,
  X,
} from "lucide-react";
import { formatMoney } from "@/lib/plans";

export type ManageBookingData = {
  token: string;
  startAt: string;
  endAt: string;
  status: string;
  price: number;
  durationMin: number;
  clientName: string;
  serviceName: string;
  serviceId: string;
  staffName: string;
  staffId: string;
  businessName: string;
  businessSlug: string;
  timezone: string;
  currency: string;
  address: string | null;
  phone: string | null;
};

function fullDate(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}

function time(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function ManageBooking({ initial }: { initial: ManageBookingData }) {
  const router = useRouter();
  const [booking, setBooking] = useState(initial);
  const [mode, setMode] = useState<"view" | "reschedule">("view");
  const [slots, setSlots] = useState<{ start: string; label: string }[]>([]);
  const [date, setDate] = useState(() => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: initial.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    return parts;
  });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const days = (() => {
    const base = new Date(`${date}T12:00:00Z`);
    return Array.from({ length: 14 }, (_, index) => {
      const d = new Date(base);
      d.setUTCDate(d.getUTCDate() + index);
      return d.toISOString().slice(0, 10);
    });
  })();

  useEffect(() => {
    if (mode !== "reschedule") return;
    let cancelled = false;
    setLoading(true);
    setSlots([]);
    fetch(
      `/api/public/${encodeURIComponent(booking.businessSlug)}/availability?staffId=${booking.staffId}&serviceId=${booking.serviceId}&date=${date}`,
    )
      .then((res) => (res.ok ? res.json() : { slots: [] }))
      .then((data: { slots: { start: string; label: string }[] }) => {
        if (!cancelled) setSlots(data.slots ?? []);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, date, booking.businessSlug, booking.staffId, booking.serviceId]);

  async function cancelBooking() {
    if (!confirm("Отменить запись? Время снова станет доступным для других.")) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/public/bookings/${booking.token}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Отменено клиентом" }),
      });
      if (!response.ok) throw new Error("failed");
      setBooking({ ...booking, status: "CANCELLED" });
      setNotice("Запись отменена");
      router.refresh();
    } catch {
      setError("Не получилось отменить. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  async function move(startAt: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/public/bookings/${booking.token}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startAt }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        startAt?: string;
        endAt?: string;
        error?: string;
      };
      if (!response.ok || !data.ok || !data.startAt || !data.endAt) {
        setError(
          data.error === "slot_unavailable"
            ? "Это время уже заняли. Выберите другое."
            : "Не получилось перенести запись.",
        );
        return;
      }
      setBooking({ ...booking, startAt: data.startAt, endAt: data.endAt });
      setMode("view");
      setNotice("Запись перенесена");
      router.refresh();
    } catch {
      setError("Нет связи с сервером.");
    } finally {
      setBusy(false);
    }
  }

  const cancelled = booking.status === "CANCELLED";

  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-line bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-xl items-center justify-between px-5">
          <Link href={`/${booking.businessSlug}`} className="inline-flex items-center gap-2 text-[12.5px] text-muted hover:text-ink">
            <ArrowLeft size={15} strokeWidth={1.7} /> {booking.businessName}
          </Link>
          <span className="badge bg-white text-muted ring-1 ring-line">Управление записью</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl px-5 py-8">
        <div className="rounded-[28px] bg-white p-1.5 ring-1 ring-black/[0.05]">
          <div className="rounded-[calc(28px-6px)] p-6 ring-1 ring-black/[0.03] sm:p-7">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10.5px] font-semibold tracking-[0.16em] text-muted uppercase">
                  {cancelled ? "Запись отменена" : booking.status === "PENDING" ? "Ждёт подтверждения" : "Вы записаны"}
                </p>
                <h1 className="mt-2 text-[27px] leading-tight font-semibold tracking-[-0.03em]">
                  {fullDate(booking.startAt, booking.timezone)}
                </h1>
                <p className="mt-1 flex items-center gap-1.5 text-[15px] font-medium text-muted">
                  <Clock3 size={15} strokeWidth={1.7} />
                  {time(booking.startAt, booking.timezone)} — {time(booking.endAt, booking.timezone)}
                </p>
              </div>
              <span
                className={`grid size-11 shrink-0 place-items-center rounded-full ${
                  cancelled ? "bg-rose/10 text-rose" : "bg-mint/10 text-mint"
                }`}
              >
                {cancelled ? <X size={20} strokeWidth={1.8} /> : <Check size={20} strokeWidth={2} />}
              </span>
            </div>

            <div className="mt-6 space-y-3 rounded-2xl bg-paper p-4 ring-1 ring-line/60">
              <div className="flex items-center gap-2.5 text-[13px]">
                <Scissors size={15} strokeWidth={1.6} className="text-muted" />
                <span className="font-medium">{booking.serviceName}</span>
                <span className="ml-auto text-muted">
                  {formatMoney(booking.price, booking.currency)}
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-[13px]">
                <span className="grid size-5 place-items-center rounded-full bg-ink text-[9px] font-semibold text-white">
                  {booking.staffName.slice(0, 1)}
                </span>
                <span>Мастер — {booking.staffName}</span>
              </div>
              {booking.address && (
                <div className="flex items-center gap-2.5 text-[12.5px] text-muted">
                  <MapPin size={15} strokeWidth={1.6} />
                  {booking.address}
                </div>
              )}
            </div>

            {notice && (
              <div className="mt-4 rounded-xl border border-mint/20 bg-mint/5 px-3.5 py-2.5 text-[12.5px] text-mint">
                {notice}
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-xl border border-rose/20 bg-rose/5 px-3.5 py-2.5 text-[12.5px] text-rose">
                {error}
              </div>
            )}

            {!cancelled && mode === "view" && (
              <div className="mt-6 space-y-2">
                <button
                  onClick={() => setMode("reschedule")}
                  className="btn btn-primary w-full"
                  disabled={busy}
                >
                  <RotateCcw size={15} strokeWidth={1.8} /> Перенести запись
                </button>
                <button
                  onClick={cancelBooking}
                  disabled={busy}
                  className="btn btn-ghost w-full text-[13px] text-rose hover:border-rose/30 hover:bg-rose/5"
                >
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <X size={15} />}
                  Отменить запись
                </button>
              </div>
            )}

            {cancelled && (
              <div className="mt-6">
                <p className="text-[12.5px] leading-relaxed text-muted">
                  Если планы изменились снова — можно записаться заново на любое свободное время.
                </p>
                <Link href={`/${booking.businessSlug}`} className="btn btn-primary mt-4 w-full">
                  Выбрать новое время
                </Link>
              </div>
            )}

            {mode === "reschedule" && !cancelled && (
              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[13px] font-semibold">Выберите новый день</p>
                  <button
                    onClick={() => {
                      setMode("view");
                      setError(null);
                    }}
                    className="text-[11.5px] text-muted underline underline-offset-4 hover:text-ink"
                  >
                    Закрыть
                  </button>
                </div>

                <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                  {days.map((day) => {
                    const active = day === date;
                    const weekday = new Intl.DateTimeFormat("ru-RU", {
                      timeZone: booking.timezone,
                      weekday: "short",
                    }).format(new Date(`${day}T12:00:00Z`));
                    const dayNumber = new Intl.DateTimeFormat("ru-RU", {
                      timeZone: booking.timezone,
                      day: "numeric",
                    }).format(new Date(`${day}T12:00:00Z`));
                    return (
                      <button
                        key={day}
                        onClick={() => setDate(day)}
                        className={`flex min-w-[52px] flex-col items-center rounded-xl border py-2 transition-colors ${
                          active ? "border-ink bg-ink text-white" : "border-line bg-white"
                        }`}
                      >
                        <span className="text-[9.5px] uppercase opacity-70">{weekday}</span>
                        <span className="text-[14px] font-semibold tabular-nums">{dayNumber}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 grid grid-cols-4 gap-2">
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="h-10 animate-pulse rounded-lg bg-paper" />
                    ))
                  ) : slots.length > 0 ? (
                    slots.map((slot) => (
                      <button
                        key={slot.start}
                        onClick={() => move(slot.start)}
                        disabled={busy}
                        className="rounded-lg border border-line py-2.5 text-[13px] font-medium tabular-nums transition-colors hover:border-ink hover:bg-ink hover:text-white disabled:opacity-50"
                      >
                        {slot.label}
                      </button>
                    ))
                  ) : (
                    <div className="col-span-4 py-8 text-center text-[12.5px] text-muted">
                      <CalendarDays size={18} strokeWidth={1.4} className="mx-auto mb-2 text-muted/50" />
                      На этот день свободного времени нет
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {booking.phone && (
          <p className="mt-5 text-center text-[12px] text-muted">
            Вопросы по записи:{" "}
            <a href={`tel:${booking.phone.replace(/\s/g, "")}`} className="font-medium text-ink underline underline-offset-4">
              {booking.phone}
            </a>
          </p>
        )}

        <p className="mt-6 text-center text-[10.5px] text-muted">
          Ссылка персональная — не передавайте её другим.
        </p>
      </main>
    </div>
  );
}
