"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Ban,
  CalendarOff,
  Clock,
  Coffee,
  Loader2,
  Plus,
  TriangleAlert,
  X,
} from "lucide-react";
import { blockTimeAction, toggleDayOffAction } from "@/server/actions/quick-actions";

type StaffOption = { id: string; name: string };

export function QuickActions({
  staff,
  date,
}: {
  staff: StaffOption[];
  date: string;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<"block" | "dayOff" | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<string>(staff[0]?.id ?? "");
  const [startMinute, setStartMinute] = useState<number>(13 * 60); // 13:00 default lunch
  const [endMinute, setEndMinute] = useState<number>(14 * 60); // 14:00
  const [reason, setReason] = useState<string>("Обед");
  const [dayOffStaff, setDayOffStaff] = useState<string>("all");
  const [isClosed, setIsClosed] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleBlockTime() {
    setError(null);
    startTransition(async () => {
      const res = await blockTimeAction({
        staffId: selectedStaff,
        date,
        startMinute: Number(startMinute),
        endMinute: Number(endMinute),
        reason,
      });
      if (res.ok) {
        setModal(null);
        router.refresh();
      } else {
        setError(res.error || "Ошибка сохранения");
      }
    });
  }

  function handleDayOff() {
    setError(null);
    startTransition(async () => {
      const res = await toggleDayOffAction({
        staffId: dayOffStaff,
        date,
        isClosed,
      });
      if (res.ok) {
        setModal(null);
        router.refresh();
      } else {
        setError(res.error || "Ошибка сохранения");
      }
    });
  }

  // Generate 30-min time options from 08:00 to 22:00
  const timeOptions: { minute: number; label: string }[] = [];
  for (let m = 8 * 60; m <= 22 * 60; m += 30) {
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    timeOptions.push({ minute: m, label: `${hh}:${mm}` });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/dashboard/bookings" className="btn btn-primary h-10 text-[12.5px]">
          <Plus size={15} strokeWidth={1.8} /> Новая запись
        </Link>

        {staff.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setModal("block");
              }}
              className="btn btn-secondary h-10 text-[12.5px]"
            >
              <Coffee size={15} strokeWidth={1.7} /> Заблокировать перерыв
            </button>

            <button
              type="button"
              onClick={() => {
                setError(null);
                setModal("dayOff");
              }}
              className="btn btn-secondary h-10 text-[12.5px]"
            >
              <CalendarOff size={15} strokeWidth={1.7} /> Выходной
            </button>
          </>
        )}
      </div>

      {/* Modal: Block Time */}
      {modal === "block" && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-lift ring-1 ring-line/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coffee size={18} className="text-brand" />
                <h3 className="text-[16px] font-semibold">Блокировка времени</h3>
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="grid size-7 place-items-center rounded-lg text-muted hover:bg-paper"
              >
                <X size={16} />
              </button>
            </div>

            <p className="mt-1 text-[12px] text-muted">
              Заблокированное время станет недоступным для онлайн-записи клиентов.
            </p>

            {error && (
              <div className="mt-3 rounded-xl border border-rose/20 bg-rose/5 px-3 py-2 text-[12px] text-rose">
                {error}
              </div>
            )}

            <div className="mt-4 space-y-3">
              <div>
                <label className="label-base">Мастер</label>
                <select
                  value={selectedStaff}
                  onChange={(e) => setSelectedStaff(e.target.value)}
                  className="input-base"
                >
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-base">С</label>
                  <select
                    value={startMinute}
                    onChange={(e) => setStartMinute(Number(e.target.value))}
                    className="input-base"
                  >
                    {timeOptions.map((opt) => (
                      <option key={opt.minute} value={opt.minute}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-base">До</label>
                  <select
                    value={endMinute}
                    onChange={(e) => setEndMinute(Number(e.target.value))}
                    className="input-base"
                  >
                    {timeOptions.map((opt) => (
                      <option key={opt.minute} value={opt.minute}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="label-base">Причина / заметка</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Обед, личные дела, технический перерыв"
                  className="input-base"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="btn btn-ghost h-9 text-[12.5px]"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={handleBlockTime}
                className="btn btn-primary h-9 text-[12.5px]"
              >
                {pending ? <Loader2 size={14} className="animate-spin" /> : "Заблокировать"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Day Off */}
      {modal === "dayOff" && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-lift ring-1 ring-line/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarOff size={18} className="text-amber" />
                <h3 className="text-[16px] font-semibold">Выходной день на {date}</h3>
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="grid size-7 place-items-center rounded-lg text-muted hover:bg-paper"
              >
                <X size={16} />
              </button>
            </div>

            <p className="mt-1 text-[12px] text-muted">
              Установите выходной день, чтобы клиенты не могли записаться на эту дату.
            </p>

            {error && (
              <div className="mt-3 rounded-xl border border-rose/20 bg-rose/5 px-3 py-2 text-[12px] text-rose">
                {error}
              </div>
            )}

            <div className="mt-4 space-y-3">
              <div>
                <label className="label-base">Кому назначить выходной</label>
                <select
                  value={dayOffStaff}
                  onChange={(e) => setDayOffStaff(e.target.value)}
                  className="input-base"
                >
                  <option value="all">Все мастера (салон закрыт)</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label-base">Действие</label>
                <select
                  value={isClosed ? "close" : "open"}
                  onChange={(e) => setIsClosed(e.target.value === "close")}
                  className="input-base"
                >
                  <option value="close">Сделать нерабочим днем (Выходной)</option>
                  <option value="open">Вернуть обычный рабочий график</option>
                </select>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="btn btn-ghost h-9 text-[12.5px]"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={handleDayOff}
                className="btn btn-primary h-9 text-[12.5px]"
              >
                {pending ? <Loader2 size={14} className="animate-spin" /> : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
