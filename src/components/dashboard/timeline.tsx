"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BadgeCheck,
  CalendarClock,
  Check,
  ExternalLink,
  Loader2,
  Phone,
  UserX,
  X,
} from "lucide-react";
import { setBookingStatus } from "@/server/actions/bookings";
import { formatMoney } from "@/lib/plans";

export type TimelineStaff = { id: string; name: string; color: string; title: string | null };

export type TimelineBooking = {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  price: number;
  durationMin: number;
  clientName: string;
  clientPhone: string;
  note: string | null;
  staffId: string;
  staffName: string;
  staffColor: string;
  serviceName: string;
  manageToken: string;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Ждёт подтверждения",
  CONFIRMED: "Подтверждена",
  COMPLETED: "Завершена",
  NO_SHOW: "Не пришёл",
  CANCELLED: "Отменена",
};

function minutesInZone(iso: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

function timeInZone(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function DayTimeline({
  staff,
  bookings,
  hours,
  timezone,
  currency,
}: {
  staff: TimelineStaff[];
  bookings: TimelineBooking[];
  hours: Record<string, { startMinute: number; endMinute: number }[]>;
  timezone: string;
  currency: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<TimelineBooking | null>(null);
  const [showCancelled, setShowCancelled] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [pending, startTransition] = useTransition();

  const allHours = Object.values(hours).flat();
  const rangeStart = allHours.length
    ? Math.floor(Math.min(...allHours.map((h) => h.startMinute)) / 60) * 60
    : 9 * 60;
  const rangeEnd = allHours.length
    ? Math.ceil(Math.max(...allHours.map((h) => h.endMinute)) / 60) * 60
    : 21 * 60;
  const hourHeight = 68;
  const totalHeight = Math.max(1, (rangeEnd - rangeStart) / 60) * hourHeight;
  const hoursList = Array.from(
    { length: Math.max(1, (rangeEnd - rangeStart) / 60 + 1) },
    (_, i) => rangeStart + i * 60,
  );

  function act(status: "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW", reason?: string) {
    if (!selected) return;
    startTransition(async () => {
      const result = await setBookingStatus(selected.id, status);
      if (result.ok) {
        setSelected(null);
        setShowCancelPrompt(false);
        setCancelReason("");
        router.refresh();
      }
    });
  }

  if (staff.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-white/60 px-6 py-12 text-center">
        <p className="text-[14px] font-medium">Пока нет мастеров</p>
        <p className="mx-auto mt-1.5 max-w-xs text-[12.5px] leading-relaxed text-muted">
          Добавьте первого мастера и его график, чтобы записи появлялись в таймлайне.
        </p>
        <Link href="/dashboard/staff" className="btn btn-primary mt-5 h-10 text-[13px]">
          Добавить мастера
        </Link>
      </div>
    );
  }

  const cancelledCount = bookings.filter((b) => b.status === "CANCELLED").length;
  const visibleBookings = showCancelled ? bookings : bookings.filter((b) => b.status !== "CANCELLED");

  return (
    <div className="relative">
      {cancelledCount > 0 && (
        <div className="mb-3 flex justify-end">
          <label className="inline-flex cursor-pointer items-center gap-2 text-[11.5px] text-muted hover:text-ink">
            <input
              type="checkbox"
              checked={showCancelled}
              onChange={(e) => setShowCancelled(e.target.checked)}
              className="size-3.5 rounded border-line accent-brand"
            />
            Показать отменённые ({cancelledCount})
          </label>
        </div>
      )}

      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max gap-2">
          <div className="w-11 shrink-0 pt-[46px]">
            {hoursList.slice(0, -1).map((minute) => (
              <div
                key={minute}
                className="relative text-[10.5px] text-muted"
                style={{ height: hourHeight }}
              >
                <span className="absolute -top-1.5 right-0">
                  {String(Math.floor(minute / 60)).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {staff.map((member) => {
            const memberHours = hours[member.id] ?? [];
            const memberBookings = visibleBookings.filter((b) => b.staffId === member.id);
            return (
              <div key={member.id} className="min-w-[168px] flex-1">
                <div className="mb-2 flex h-[38px] items-center gap-2 rounded-xl bg-white px-2.5 ring-1 ring-line">
                  <span
                    className="grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold text-white"
                    style={{ background: member.color }}
                  >
                    {member.name.slice(0, 1)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-semibold">{member.name}</p>
                    <p className="truncate text-[10px] text-muted">
                      {member.title || "Мастер"}
                    </p>
                  </div>
                </div>

                <div
                  className="relative overflow-hidden rounded-xl bg-[#f4f4f8] ring-1 ring-line/70"
                  style={{ height: totalHeight }}
                >
                  {hoursList.slice(0, -1).map((minute, index) => (
                    <div
                      key={minute}
                      className="absolute inset-x-0 border-t border-line/60"
                      style={{ top: index * hourHeight }}
                    />
                  ))}

                  {memberHours.map((range, index) => {
                    const top = ((range.startMinute - rangeStart) / 60) * hourHeight;
                    const height = ((range.endMinute - range.startMinute) / 60) * hourHeight;
                    return (
                      <div
                        key={index}
                        className="absolute inset-x-0 bg-white"
                        style={{ top, height }}
                      />
                    );
                  })}

                  {memberBookings.map((booking) => {
                    const startMin = minutesInZone(booking.startAt, timezone);
                    const endMin = minutesInZone(booking.endAt, timezone);
                    const top = ((startMin - rangeStart) / 60) * hourHeight;
                    const height = Math.max(30, ((endMin - startMin) / 60) * hourHeight - 2);

                    const isBlock = booking.note?.startsWith("[БЛОКИРОВКА]");
                    const nowMs = Date.now();
                    const bookingStartMs = new Date(booking.startAt).getTime();
                    const bookingEndMs = new Date(booking.endAt).getTime();
                    const isLate =
                      !isBlock &&
                      booking.status === "CONFIRMED" &&
                      nowMs - bookingStartMs > 10 * 60_000 &&
                      nowMs < bookingEndMs + 60 * 60_000;
                    const lateMins = isLate ? Math.floor((nowMs - bookingStartMs) / 60_000) : 0;

                    let background = `${booking.staffColor}16`;
                    let border = booking.staffColor;
                    let opacity = 1;

                    if (isBlock) {
                      background = "#6b728014";
                      border = "#6b7280";
                    } else if (booking.status === "PENDING") {
                      background = "#f5a52414";
                      border = "#f5a524";
                    } else if (booking.status === "COMPLETED") {
                      background = "#12b88614";
                      border = "#12b886";
                    } else if (booking.status === "NO_SHOW") {
                      background = "#f43f5e14";
                      border = "#f43f5e";
                    } else if (booking.status === "CANCELLED") {
                      background = "#9ca3af12";
                      border = "#9ca3af";
                      opacity = 0.55;
                    }

                    return (
                      <button
                        key={booking.id}
                        onClick={() => {
                          setSelected(booking);
                          setShowCancelPrompt(false);
                          setCancelReason("");
                        }}
                        className={`absolute right-1 left-1 overflow-hidden rounded-lg px-2 py-1.5 text-left transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:z-10 hover:scale-[1.02] hover:shadow-soft ${
                          booking.status === "CANCELLED" ? "line-through opacity-60" : ""
                        }`}
                        style={{
                          top,
                          height,
                          background,
                          borderLeft: `3px solid ${border}`,
                          opacity,
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-[10.5px] font-semibold tabular-nums">
                            {timeInZone(booking.startAt, timezone)}
                          </p>
                          {isLate && (
                            <span className="rounded bg-amber px-1 py-0.2 text-[9px] font-bold text-white">
                              +{lateMins}м
                            </span>
                          )}
                          {isBlock && <span className="text-[10px]">🔒</span>}
                        </div>
                        <p className="truncate text-[11px] font-medium">
                          {isBlock ? booking.note?.replace("[БЛОКИРОВКА]", "").trim() || "Перерыв" : booking.clientName}
                        </p>
                        <p className="truncate text-[10px] text-muted">
                          {isBlock ? "Недоступно для записи" : booking.serviceName}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]"
            onClick={() => setSelected(null)}
            aria-label="Закрыть"
          />
          <div className="relative z-10 flex h-full w-full max-w-[380px] flex-col overflow-y-auto bg-white shadow-lift animate-rise">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <p className="text-[13px] font-semibold">
                {selected.note?.startsWith("[БЛОКИРОВКА]") ? "Блокировка времени" : "Запись"}
              </p>
              <button
                onClick={() => setSelected(null)}
                className="grid size-8 place-items-center rounded-lg bg-paper text-muted hover:text-ink"
                aria-label="Закрыть"
              >
                <X size={16} strokeWidth={1.6} />
              </button>
            </div>

            <div className="flex-1 space-y-5 px-5 py-5">
              <div>
                <span
                  className={`badge ${
                    selected.status === "PENDING"
                      ? "bg-amber/10 text-amber"
                      : selected.status === "COMPLETED"
                        ? "bg-mint/10 text-mint"
                        : selected.status === "NO_SHOW"
                          ? "bg-rose/10 text-rose"
                          : selected.status === "CANCELLED"
                            ? "bg-paper text-muted"
                            : ""
                  }`}
                >
                  {STATUS_LABEL[selected.status] ?? selected.status}
                </span>

                {selected.status === "CONFIRMED" &&
                  Date.now() - new Date(selected.startAt).getTime() > 10 * 60_000 &&
                  Date.now() < new Date(selected.endAt).getTime() + 60 * 60_000 &&
                  !selected.note?.startsWith("[БЛОКИРОВКА]") && (
                    <div className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-amber/25 bg-amber/10 px-2.5 py-1.5 text-[11.5px] font-medium text-amber">
                      <span>⚠️ Клиент опаздывает на {Math.floor((Date.now() - new Date(selected.startAt).getTime()) / 60_000)} мин</span>
                    </div>
                  )}

                <p className="mt-3 text-[22px] leading-tight font-semibold">
                  {selected.note?.startsWith("[БЛОКИРОВКА]")
                    ? selected.note.replace("[БЛОКИРОВКА]", "").trim() || "Перерыв"
                    : selected.clientName}
                </p>
                {selected.clientPhone !== "-" && (
                  <a
                    href={`tel:${selected.clientPhone}`}
                    className="mt-1 inline-flex items-center gap-1.5 text-[12.5px] text-muted hover:text-ink"
                  >
                    <Phone size={13} strokeWidth={1.6} /> {selected.clientPhone}
                  </a>
                )}
              </div>

              <div className="space-y-2.5 rounded-2xl bg-paper p-4 ring-1 ring-line/70">
                <div className="flex items-start gap-2.5 text-[12.5px]">
                  <CalendarClock size={15} strokeWidth={1.6} className="mt-0.5 text-muted" />
                  <div>
                    <p className="font-medium">
                      {timeInZone(selected.startAt, timezone)} —{" "}
                      {timeInZone(selected.endAt, timezone)}
                    </p>
                    <p className="text-muted">
                      {selected.serviceName} · {selected.durationMin} мин
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 text-[12.5px]">
                  <span
                    className="grid size-5 place-items-center rounded-full text-[9px] font-semibold text-white"
                    style={{ background: selected.staffColor }}
                  >
                    {selected.staffName.slice(0, 1)}
                  </span>
                  <span>{selected.staffName}</span>
                </div>
                {!selected.note?.startsWith("[БЛОКИРОВКА]") && (
                  <div className="flex items-center justify-between border-t border-line pt-2.5 text-[12.5px]">
                    <span className="text-muted">Стоимость</span>
                    <span className="font-semibold">{formatMoney(selected.price, currency)}</span>
                  </div>
                )}
                {selected.note && (
                  <p className="border-t border-line pt-2.5 text-[12px] leading-relaxed text-muted">
                    «{selected.note}»
                  </p>
                )}
              </div>

              {selected.note?.startsWith("[БЛОКИРОВКА]") ? (
                <div>
                  <button
                    onClick={() => act("CANCELLED")}
                    disabled={pending}
                    className="btn btn-secondary h-11 w-full text-[13px] text-rose hover:bg-rose/5"
                  >
                    {pending ? <Loader2 size={15} className="animate-spin" /> : <X size={15} />}
                    Снять блокировку времени
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    {selected.status === "PENDING" && (
                      <button
                        onClick={() => act("CONFIRMED")}
                        disabled={pending}
                        className="btn btn-primary col-span-2 h-11"
                      >
                        {pending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                        Подтвердить
                      </button>
                    )}
                    {selected.status === "CONFIRMED" && (
                      <button
                        onClick={() => act("COMPLETED")}
                        disabled={pending}
                        className="btn btn-primary col-span-2 h-11"
                      >
                        {pending ? <Loader2 size={15} className="animate-spin" /> : <BadgeCheck size={15} />}
                        Отметить «пришёл»
                      </button>
                    )}
                    {selected.status === "CONFIRMED" && (
                      <button
                        onClick={() => act("NO_SHOW")}
                        disabled={pending}
                        className="btn btn-ghost h-10 text-[12.5px]"
                      >
                        <UserX size={14} /> Не пришёл
                      </button>
                    )}
                    {selected.status !== "CANCELLED" && (
                      <button
                        onClick={() => setShowCancelPrompt(true)}
                        disabled={pending}
                        className={`btn btn-ghost h-10 text-[12.5px] text-rose hover:border-rose/30 hover:bg-rose/5 ${
                          selected.status === "CONFIRMED" ? "" : "col-span-2"
                        }`}
                      >
                        <X size={14} /> Отменить
                      </button>
                    )}
                  </div>

                  {showCancelPrompt && (
                    <div className="rounded-xl border border-rose/20 bg-rose/5 p-3">
                      <p className="text-[12px] font-medium text-rose">Укажите причину отмены:</p>
                      <input
                        type="text"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Клиент попросил отменить, мастер заболел..."
                        className="input-base mt-2 text-[12px]"
                      />
                      <div className="mt-2.5 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowCancelPrompt(false)}
                          className="btn btn-ghost h-8 text-[11px]"
                        >
                          Назад
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => act("CANCELLED", cancelReason)}
                          className="btn btn-primary h-8 bg-rose text-[11px] hover:bg-rose/90"
                        >
                          {pending ? <Loader2 size={12} className="animate-spin" /> : "Подтвердить отмену"}
                        </button>
                      </div>
                    </div>
                  )}

                  <Link
                    href={`/b/${selected.manageToken}`}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 text-[12px] text-muted underline underline-offset-4 hover:text-ink"
                  >
                    Ссылка для клиента <ExternalLink size={12} />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
