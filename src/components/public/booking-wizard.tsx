"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Loader2,
  MapPin,
  Phone,
  UserRound,
  X,
} from "lucide-react";
import { formatMoney } from "@/lib/plans";

export type WizardService = {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  price: number;
  category: string | null;
};

export type WizardStaff = {
  id: string;
  name: string;
  title: string | null;
  photoUrl: string | null;
  color: string;
  serviceIds: string[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  slug: string;
  businessName: string;
  phone: string | null;
  address: string | null;
  timezone: string;
  currency: string;
  accent: string;
  services: WizardService[];
  staff: WizardStaff[];
  initialStaffId?: string | null;
};

type Slot = { start: string; label: string };

function todayInZone(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
}

function shiftDate(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dateParts(dateStr: string, timezone: string) {
  const instant = new Date(`${dateStr}T12:00:00Z`);
  const weekday = new Intl.DateTimeFormat("ru-RU", {
    timeZone: timezone,
    weekday: "short",
  }).format(instant);
  const day = new Intl.DateTimeFormat("ru-RU", {
    timeZone: timezone,
    day: "numeric",
  }).format(instant);
  const month = new Intl.DateTimeFormat("ru-RU", {
    timeZone: timezone,
    month: "short",
  })
    .format(instant)
    .replace(".", "");
  return { weekday, day, month };
}

function fullDate(dateStr: string, timezone: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${dateStr}T12:00:00Z`));
}

function durationLabel(minutes: number) {
  if (minutes < 60) return `${minutes} мин`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

export function BookingWizard({
  open,
  onClose,
  slug,
  businessName,
  phone,
  address,
  timezone,
  currency,
  accent,
  services,
  staff,
  initialStaffId,
}: Props) {
  const [staffId, setStaffId] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [date, setDate] = useState(() => todayInZone(timezone));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [name, setName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [doneToken, setDoneToken] = useState<string | null>(null);

  const selectedStaff = staff.find((s) => s.id === staffId) ?? null;
  const selectedService = services.find((s) => s.id === serviceId) ?? null;
  const availableServices = selectedStaff
    ? services.filter((s) => selectedStaff.serviceIds.includes(s.id))
    : services;

  const days = useMemo(() => {
    const today = todayInZone(timezone);
    return Array.from({ length: 14 }, (_, i) => shiftDate(today, i));
  }, [timezone]);

  const step = doneToken
    ? "done"
    : slot
      ? "details"
      : serviceId
        ? "time"
        : staffId
          ? "service"
          : "master";

  useEffect(() => {
    if (!open) return;
    setStaffId(initialStaffId ?? null);
    setServiceId(null);
    setSlot(null);
    setDoneToken(null);
    setError(null);
    setDate(todayInZone(timezone));
    setLoadingSlots(false);
  }, [open, initialStaffId, timezone]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !staffId || !serviceId) return;
    let cancelled = false;
    setLoadingSlots(true);
    setSlots([]);
    fetch(
      `/api/public/${encodeURIComponent(slug)}/availability?staffId=${staffId}&serviceId=${serviceId}&date=${date}`,
    )
      .then((res) => (res.ok ? res.json() : { slots: [] }))
      .then((data: { slots: Slot[] }) => {
        if (!cancelled) setSlots(data.slots ?? []);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, staffId, serviceId, date, slug]);

  if (!open) return null;

  async function submit() {
    if (!staffId || !serviceId || !slot) return;
    if (name.trim().length < 2) {
      setError("Напишите, как к вам обращаться");
      return;
    }
    if (clientPhone.replace(/\D/g, "").length < 9) {
      setError("Проверьте номер телефона");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/public/${encodeURIComponent(slug)}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId,
          serviceId,
          startAt: slot.start,
          name: name.trim(),
          phone: clientPhone.trim(),
          email: email.trim(),
          note: note.trim(),
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        manageToken?: string;
        error?: string;
      };
      if (!response.ok || !data.ok || !data.manageToken) {
        setError(
          data.error === "slot_unavailable"
            ? "Это время только что заняли. Выберите другое."
            : "Не получилось записаться. Попробуйте ещё раз.",
        );
        if (data.error === "slot_unavailable") {
          setSlot(null);
          setSlots((prev) => prev.filter((s) => s.start !== slot.start));
        }
        return;
      }
      setDoneToken(data.manageToken);
    } catch {
      setError("Нет связи с сервером. Проверьте интернет и попробуйте снова.");
    } finally {
      setSubmitting(false);
    }
  }

  function back() {
    setError(null);
    if (step === "done") return;
    if (step === "details") {
      setSlot(null);
      return;
    }
    if (step === "time") {
      setServiceId(null);
      return;
    }
    if (step === "service") {
      if (!initialStaffId) setStaffId(null);
      return;
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
      <button
        className="absolute inset-0 bg-ink/45 backdrop-blur-[3px]"
        onClick={onClose}
        aria-label="Закрыть"
      />

      <div className="relative z-10 flex max-h-[94dvh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-lift animate-rise sm:max-h-[88dvh] sm:rounded-[28px]">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-3">
            {step !== "master" && step !== "done" && (
              <button
                onClick={back}
                className="grid size-8 place-items-center rounded-lg bg-paper text-muted hover:text-ink"
                aria-label="Назад"
              >
                <ArrowLeft size={16} strokeWidth={1.7} />
              </button>
            )}
            <div>
              <p className="text-[10.5px] font-semibold tracking-[0.14em] text-muted uppercase">
                {businessName}
              </p>
              <p className="text-[14px] font-semibold">
                {step === "master" && "Выберите мастера"}
                {step === "service" && "Выберите услугу"}
                {step === "time" && "Выберите время"}
                {step === "details" && "Ваши контакты"}
                {step === "done" && "Готово"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-1 sm:flex">
              {["master", "service", "time", "details"].map((item) => (
                <span
                  key={item}
                  className="size-1.5 rounded-full transition-colors"
                  style={{
                    background:
                      ["master", "service", "time", "details"].indexOf(item) <=
                      ["master", "service", "time", "details"].indexOf(step)
                        ? accent
                        : "#e7e7ee",
                  }}
                />
              ))}
            </div>
            <button
              onClick={onClose}
              className="grid size-8 place-items-center rounded-lg bg-paper text-muted hover:text-ink"
              aria-label="Закрыть"
            >
              <X size={16} strokeWidth={1.7} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {step === "master" && (
            <div className="space-y-2.5">
              {staff.map((member) => {
                const count = member.serviceIds.length;
                return (
                  <button
                    key={member.id}
                    onClick={() => {
                      if (count === 0) return;
                      setStaffId(member.id);
                    }}
                    disabled={count === 0}
                    className="group flex w-full items-center gap-3.5 rounded-2xl border border-line p-3 text-left transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-ink/15 hover:bg-paper disabled:opacity-40"
                  >
                    <span
                      className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full text-[15px] font-semibold text-white"
                      style={{ background: member.color }}
                    >
                      {member.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={member.photoUrl}
                          alt={member.name}
                          className="size-full object-cover"
                        />
                      ) : (
                        member.name.slice(0, 1)
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold">{member.name}</p>
                      <p className="text-[12px] text-muted">
                        {member.title || "Мастер"} · {count} услуг
                      </p>
                    </div>
                    <ChevronRight
                      size={16}
                      className="text-muted transition-transform group-hover:translate-x-0.5"
                    />
                  </button>
                );
              })}
              {staff.length === 0 && (
                <p className="py-10 text-center text-[13px] text-muted">
                  Пока нет мастеров для записи.
                </p>
              )}
            </div>
          )}

          {step === "service" && selectedStaff && (
            <div className="space-y-2.5">
              {availableServices.map((service) => (
                <button
                  key={service.id}
                  onClick={() => setServiceId(service.id)}
                  className="group flex w-full items-center gap-3 rounded-2xl border border-line p-3.5 text-left transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-ink/15 hover:bg-paper"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold">{service.name}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted">
                      <Clock3 size={12} strokeWidth={1.6} />
                      {durationLabel(service.durationMin)}
                    </p>
                  </div>
                  <span className="text-[13px] font-semibold tabular-nums">
                    {formatMoney(service.price, currency)}
                  </span>
                  <ChevronRight size={16} className="text-muted" />
                </button>
              ))}
              {availableServices.length === 0 && (
                <p className="py-10 text-center text-[13px] text-muted">
                  У этого мастера пока нет услуг.
                </p>
              )}
            </div>
          )}

          {step === "time" && (
            <div>
              <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
                {days.map((day) => {
                  const parts = dateParts(day, timezone);
                  const active = day === date;
                  return (
                    <button
                      key={day}
                      onClick={() => {
                        setDate(day);
                        setSlot(null);
                      }}
                      className={`flex min-w-[58px] flex-col items-center rounded-xl border px-2 py-2 transition-all duration-300 ${
                        active ? "text-white" : "border-line bg-white text-ink-soft"
                      }`}
                      style={active ? { background: accent, borderColor: accent } : undefined}
                    >
                      <span className="text-[10px] uppercase opacity-70">{parts.weekday}</span>
                      <span className="mt-0.5 text-[16px] font-semibold tabular-nums">
                        {parts.day}
                      </span>
                      <span className="text-[9.5px] uppercase opacity-60">{parts.month}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 flex items-center justify-between">
                <p className="text-[12px] font-medium text-muted">
                  {fullDate(date, timezone)}
                </p>
                <p className="text-[11px] text-muted">
                  {selectedService ? durationLabel(selectedService.durationMin) : ""}
                </p>
              </div>

              {loadingSlots ? (
                <div className="grid grid-cols-4 gap-2 py-6">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="h-10 animate-pulse rounded-lg bg-paper" />
                  ))}
                </div>
              ) : slots.length > 0 ? (
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {slots.map((item) => (
                    <button
                      key={item.start}
                      onClick={() => setSlot(item)}
                      className="rounded-lg border border-line py-2.5 text-[13px] font-medium tabular-nums transition-all duration-200 hover:border-ink hover:bg-ink hover:text-white"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <CalendarDays size={22} strokeWidth={1.4} className="mx-auto text-muted/50" />
                  <p className="mt-3 text-[13px] font-medium">Свободного времени нет</p>
                  <p className="mt-1 text-[12px] text-muted">Попробуйте другой день или мастера.</p>
                </div>
              )}
            </div>
          )}

          {step === "details" && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-paper p-3.5 ring-1 ring-line/70">
                <p className="text-[12.5px] font-semibold">
                  {selectedService?.name} · {formatMoney(selectedService?.price ?? 0, currency)}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays size={12} /> {fullDate(date, timezone)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock3 size={12} /> {slot?.label}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <UserRound size={12} /> {selectedStaff?.name}
                  </span>
                </p>
              </div>

              <div>
                <label className="label-base" htmlFor="client-name">
                  Имя
                </label>
                <input
                  id="client-name"
                  className="input-base"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Как к вам обращаться"
                  autoComplete="name"
                />
              </div>

              <div>
                <label className="label-base" htmlFor="client-phone">
                  Телефон
                </label>
                <input
                  id="client-phone"
                  className="input-base"
                  value={clientPhone}
                  onChange={(event) => setClientPhone(event.target.value)}
                  placeholder="+998 90 123 45 67"
                  inputMode="tel"
                  autoComplete="tel"
                />
                <p className="mt-1 text-[11px] text-muted">
                  По нему салон свяжется, если что-то изменится.
                </p>
              </div>

              <div>
                <label className="label-base" htmlFor="client-email">
                  Email <span className="font-normal normal-case text-muted">(необязательно)</span>
                </label>
                <input
                  id="client-email"
                  className="input-base"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@mail.com"
                  inputMode="email"
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="label-base" htmlFor="client-note">
                  Комментарий <span className="font-normal normal-case text-muted">(необязательно)</span>
                </label>
                <textarea
                  id="client-note"
                  className="input-base h-20 resize-none py-2.5"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Пожелания к записи"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-rose/20 bg-rose/5 px-3.5 py-2.5 text-[12.5px] text-rose">
                  {error}
                </div>
              )}

              <button
                onClick={submit}
                disabled={submitting}
                className="btn w-full text-white"
                style={{ background: accent }}
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : "Записаться"}
              </button>
              <p className="text-center text-[10.5px] leading-relaxed text-muted">
                Нажимая «Записаться», вы соглашаетесь на обработку контактных данных.
              </p>
            </div>
          )}

          {step === "done" && doneToken && (
            <div className="py-6 text-center">
              <span
                className="mx-auto grid size-14 place-items-center rounded-full text-white"
                style={{ background: accent }}
              >
                <Check size={26} strokeWidth={2} />
              </span>
              <h3 className="mt-5 text-[22px] font-semibold tracking-[-0.02em]">Вы записаны</h3>
              <p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed text-muted">
                {selectedService?.name} · {fullDate(date, timezone)} в {slot?.label}. Мастер —{" "}
                {selectedStaff?.name}.
              </p>

              <div className="mt-6 space-y-2 text-left">
                <a
                  href={`/b/${doneToken}`}
                  className="btn btn-primary w-full"
                >
                  Управлять записью
                </a>
                <button onClick={onClose} className="btn btn-ghost w-full">
                  Закрыть
                </button>
              </div>

              {(phone || address) && (
                <div className="mt-6 space-y-1.5 border-t border-line pt-4 text-[11.5px] text-muted">
                  {address && (
                    <p className="inline-flex items-center gap-1.5">
                      <MapPin size={12} /> {address}
                    </p>
                  )}
                  {phone && (
                    <p className="inline-flex items-center gap-1.5">
                      <Phone size={12} /> {phone}
                    </p>
                  )}
                </div>
              )}
              <p className="mt-4 text-[10.5px] text-muted">
                Ссылка на управление записью придёт в Telegram, если салон подключил бота.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
