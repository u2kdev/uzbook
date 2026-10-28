"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, Clock, Loader2, User } from "lucide-react";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { formatMoney } from "@/lib/plans";

export type CalendarBooking = {
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
  serviceId: string;
  serviceName: string;
  staffId: string;
  staffName: string;
  staffColor: string;
  manageToken: string;
};

type StaffOption = { id: string; name: string; color: string; title: string | null };

const STATUS_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  PENDING: { bg: "#fef3c7", border: "#f59e0b", text: "#b45309" },
  CONFIRMED: { bg: "#e0e7ff", border: "#6366f1", text: "#4338ca" },
  COMPLETED: { bg: "#d1fae5", border: "#10b981", text: "#065f46" },
  NO_SHOW: { bg: "#fee2e2", border: "#ef4444", text: "#991b1b" },
  CANCELLED: { bg: "#f3f4f6", border: "#9ca3af", text: "#6b7280" },
};

function getWeekMonday(dateStr: string): Date {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay();
  // day: 0 is Sunday, 1 is Monday ... 6 is Saturday
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

export function WeekCalendar({
  bookings,
  staff,
  timezone,
  currency,
  today,
  onSelectBooking,
  onReschedule,
}: {
  bookings: CalendarBooking[];
  staff: StaffOption[];
  timezone: string;
  currency: string;
  today: string;
  onSelectBooking: (b: CalendarBooking) => void;
  onReschedule: (bookingId: string, newStartAt: string, newStaffId?: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [currentMonday, setCurrentMonday] = useState<Date>(() => getWeekMonday(today));
  const [activeBooking, setActiveBooking] = useState<CalendarBooking | null>(null);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px drag so clicks on card don't accidentally drag
      },
    }),
  );

  // Generate 7 days of the current week (Monday to Sunday)
  const weekDays = useMemo(() => {
    const days: { dateStr: string; label: string; weekdayName: string; isToday: boolean }[] = [];
    const base = new Date(currentMonday);
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setUTCDate(base.getUTCDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const isToday = dateStr === today;
      const weekdayName = new Intl.DateTimeFormat("ru-RU", { weekday: "short" }).format(d);
      const label = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(d);
      days.push({ dateStr, label, weekdayName, isToday });
    }
    return days;
  }, [currentMonday, today]);

  // Working hours range (e.g. 09:00 to 21:00)
  const hours = useMemo(() => {
    const list: number[] = [];
    for (let h = 9; h <= 20; h++) {
      list.push(h);
    }
    return list;
  }, []);

  function handlePrevWeek() {
    const d = new Date(currentMonday);
    d.setUTCDate(d.getUTCDate() - 7);
    setCurrentMonday(d);
    setErrorMessage(null);
  }

  function handleNextWeek() {
    const d = new Date(currentMonday);
    d.setUTCDate(d.getUTCDate() + 7);
    setCurrentMonday(d);
    setErrorMessage(null);
  }

  function handleTodayWeek() {
    setCurrentMonday(getWeekMonday(today));
    setErrorMessage(null);
  }

  function handleDragStart(event: DragStartEvent) {
    const booking = event.active.data.current?.booking as CalendarBooking | undefined;
    if (booking) {
      setActiveBooking(booking);
      setErrorMessage(null);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveBooking(null);
    const { active, over } = event;
    if (!over) return;

    const booking = active.data.current?.booking as CalendarBooking | undefined;
    if (!booking) return;

    // over.id format: `slot_${dateStr}_${hour}`
    const overId = String(over.id);
    if (!overId.startsWith("slot_")) return;

    const parts = overId.split("_");
    const targetDate = parts[1]; // yyyy-MM-dd
    const targetHour = parseInt(parts[2], 10); // 9..20

    // Build ISO timestamp in the salon's timezone
    const hh = String(targetHour).padStart(2, "0");
    const targetIsoString = `${targetDate}T${hh}:00:00`;
    const newInstant = fromZonedTime(targetIsoString, timezone);

    // If time didn't change, do nothing
    if (new Date(booking.startAt).getTime() === newInstant.getTime()) {
      return;
    }

    setReschedulingId(booking.id);
    try {
      const res = await onReschedule(booking.id, newInstant.toISOString());
      if (!res.ok) {
        setErrorMessage(res.error || "Не удалось перенести запись");
      }
    } catch {
      setErrorMessage("Ошибка сети при переносе записи");
    } finally {
      setReschedulingId(null);
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-3">
        {/* Navigation & header */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-3 ring-1 ring-line/80">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevWeek}
              className="grid size-8 place-items-center rounded-lg border border-line hover:bg-paper"
              aria-label="Предыдущая неделя"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={handleTodayWeek}
              className="rounded-lg border border-line px-3 py-1 text-[12px] font-medium hover:bg-paper"
            >
              Текущая неделя
            </button>
            <button
              onClick={handleNextWeek}
              className="grid size-8 place-items-center rounded-lg border border-line hover:bg-paper"
              aria-label="Следующая неделя"
            >
              <ChevronRight size={16} />
            </button>

            <span className="ml-2 text-[13px] font-semibold">
              {weekDays[0].label} — {weekDays[6].label}
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-muted">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-brand" /> Подтверждена
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-amber" /> Ждёт
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-mint" /> Пришёл
            </span>
            <span className="text-[10px] text-muted italic">
              (перетаскивайте карточки для переноса)
            </span>
          </div>
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-rose/25 bg-rose/5 px-4 py-2.5 text-[12px] text-rose">
            {errorMessage}
          </div>
        )}

        {/* Weekly Grid */}
        <div className="overflow-x-auto rounded-[24px] bg-white ring-1 ring-line/80">
          <div className="min-w-[850px]">
            {/* Days header row */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-line bg-paper/50">
              <div className="border-r border-line p-2 text-center text-[10.5px] font-medium text-muted">
                Время
              </div>
              {weekDays.map((d) => (
                <div
                  key={d.dateStr}
                  className={`border-r border-line p-2.5 text-center last:border-r-0 ${
                    d.isToday ? "bg-brand/5" : ""
                  }`}
                >
                  <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                    {d.weekdayName}
                  </p>
                  <p
                    className={`mt-0.5 text-[13px] font-bold ${
                      d.isToday ? "text-brand" : "text-ink"
                    }`}
                  >
                    {d.label}
                  </p>
                </div>
              ))}
            </div>

            {/* Time rows */}
            <div className="divide-y divide-line/60">
              {hours.map((hour) => (
                <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)]">
                  {/* Hour label */}
                  <div className="border-r border-line p-2 text-right text-[11px] font-medium text-muted">
                    {String(hour).padStart(2, "0")}:00
                  </div>

                  {/* 7 Droppable Day Columns */}
                  {weekDays.map((d) => {
                    const slotId = `slot_${d.dateStr}_${hour}`;
                    const slotBookings = bookings.filter((b) => {
                      const bDate = formatInTimeZone(new Date(b.startAt), timezone, "yyyy-MM-dd");
                      const bHour = parseInt(
                        formatInTimeZone(new Date(b.startAt), timezone, "H"),
                        10,
                      );
                      return bDate === d.dateStr && bHour === hour;
                    });

                    return (
                      <DroppableSlot
                        key={slotId}
                        slotId={slotId}
                        isToday={d.isToday}
                      >
                        {slotBookings.map((b) => (
                          <DraggableBookingCard
                            key={b.id}
                            booking={b}
                            timezone={timezone}
                            currency={currency}
                            isRescheduling={reschedulingId === b.id}
                            onSelectBooking={onSelectBooking}
                          />
                        ))}
                      </DroppableSlot>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeBooking && (
          <div className="w-36 rounded-xl border-2 border-brand bg-white p-2 shadow-lift">
            <p className="truncate text-[11px] font-semibold">{activeBooking.clientName}</p>
            <p className="truncate text-[10px] text-muted">{activeBooking.serviceName}</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function DroppableSlot({
  slotId,
  isToday,
  children,
}: {
  slotId: string;
  isToday: boolean;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: slotId });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[64px] border-r border-line/60 p-1 transition-colors last:border-r-0 ${
        isOver ? "bg-brand/10 ring-2 ring-brand/40 ring-inset" : isToday ? "bg-brand/[0.02]" : "hover:bg-paper/30"
      }`}
    >
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function DraggableBookingCard({
  booking,
  timezone,
  currency,
  isRescheduling,
  onSelectBooking,
}: {
  booking: CalendarBooking;
  timezone: string;
  currency: string;
  isRescheduling: boolean;
  onSelectBooking: (b: CalendarBooking) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: booking.id,
    data: { booking },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 50,
      }
    : undefined;

  const isBlock = booking.note?.startsWith("[БЛОКИРОВКА]");
  const timeStr = formatInTimeZone(new Date(booking.startAt), timezone, "HH:mm");

  const colorScheme = STATUS_STYLE[booking.status] ?? STATUS_STYLE.CONFIRMED;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onSelectBooking(booking)}
      className={`group relative cursor-grab rounded-lg p-1.5 text-left text-[11px] shadow-xs transition-shadow hover:shadow-soft active:cursor-grabbing ${
        isDragging ? "opacity-30" : "opacity-100"
      } ${booking.status === "CANCELLED" ? "line-through opacity-50" : ""}`}
      style={{
        ...style,
        backgroundColor: isBlock ? "#f3f4f6" : colorScheme.bg,
        borderLeft: `3px solid ${isBlock ? "#6b7280" : colorScheme.border}`,
      }}
    >
      {isRescheduling && (
        <div className="absolute inset-0 grid place-items-center rounded-lg bg-white/70">
          <Loader2 size={12} className="animate-spin text-brand" />
        </div>
      )}
      <div className="flex items-center justify-between font-semibold">
        <span className="tabular-nums" style={{ color: colorScheme.text }}>
          {timeStr}
        </span>
        <span
          className="size-1.5 rounded-full"
          style={{ background: booking.staffColor }}
          title={booking.staffName}
        />
      </div>
      <p className="truncate font-medium text-ink">
        {isBlock ? booking.note?.replace("[БЛОКИРОВКА]", "").trim() || "Перерыв" : booking.clientName}
      </p>
      <p className="truncate text-[10px] text-muted">
        {isBlock ? "🔒 Перерыв" : booking.serviceName}
      </p>
    </div>
  );
}
