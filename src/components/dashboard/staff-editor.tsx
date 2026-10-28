"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  Calendar,
  CalendarOff,
  Check,
  Clock,
  Loader2,
  Plus,
  Save,
  Trash2,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import {
  addScheduleExceptionAction,
  deleteScheduleExceptionAction,
  deleteStaffAction,
  saveScheduleAction,
  toggleStaffAction,
  updateStaffAction,
  type ActionState,
} from "@/server/actions/catalog";
import { formatMoney } from "@/lib/plans";

const COLORS = [
  "#6e56f8",
  "#12b886",
  "#f5a524",
  "#f04d6a",
  "#2f9e8f",
  "#0f8bd6",
  "#8b5cf6",
  "#eb6f3f",
];

const WEEKDAYS = [
  { id: 1, label: "Понедельник", short: "Пн" },
  { id: 2, label: "Вторник", short: "Вт" },
  { id: 3, label: "Среда", short: "Ср" },
  { id: 4, label: "Четверг", short: "Чт" },
  { id: 5, label: "Пятница", short: "Пт" },
  { id: 6, label: "Суббота", short: "Сб" },
  { id: 0, label: "Воскресенье", short: "Вс" },
];

function minutesToTimeString(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function timeStringToMinutes(str: string) {
  const [h, m] = str.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export type StaffMemberData = {
  id: string;
  name: string;
  title: string | null;
  bio: string | null;
  color: string;
  isActive: boolean;
  serviceIds: string[];
};

export type WorkingHourData = {
  weekday: number;
  startMinute: number;
  endMinute: number;
};

export type ScheduleExceptionData = {
  id: string;
  date: string;
  isClosed: boolean;
  startMinute: number | null;
  endMinute: number | null;
};

export type ServiceOption = {
  id: string;
  name: string;
  isActive: boolean;
};

export function StaffEditor({
  member,
  services,
  schedule,
  exceptions = [],
  stats,
  currency = "UZS",
}: {
  member: StaffMemberData;
  services: ServiceOption[];
  schedule: WorkingHourData[];
  exceptions?: ScheduleExceptionData[];
  stats?: {
    totalBookings: number;
    completedVisits: number;
    totalRevenue: number;
    totalHours: number;
  };
  currency?: string;
}) {
  const router = useRouter();
  const [profileState, profileFormAction, profilePending] = useActionState<ActionState, FormData>(
    updateStaffAction,
    null,
  );
  const [selectedColor, setSelectedColor] = useState(member.color || COLORS[0]);
  const [selectedServices, setSelectedServices] = useState<string[]>(member.serviceIds);

  // Weekly schedule state
  const [scheduleState, setScheduleState] = useState<
    Record<number, { active: boolean; start: string; end: string }>
  >(() => {
    const map: Record<number, { active: boolean; start: string; end: string }> = {};
    for (const w of WEEKDAYS) {
      const match = schedule.find((h) => h.weekday === w.id);
      if (match) {
        map[w.id] = {
          active: true,
          start: minutesToTimeString(match.startMinute),
          end: minutesToTimeString(match.endMinute),
        };
      } else {
        map[w.id] = {
          active: false,
          start: "10:00",
          end: "20:00",
        };
      }
    }
    return map;
  });

  const [schedulePending, startScheduleTransition] = useTransition();
  const [scheduleMessage, setScheduleMessage] = useState<{ ok?: boolean; error?: string } | null>(
    null,
  );

  // Schedule exceptions state
  const [newExceptionDate, setNewExceptionDate] = useState(
    new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  );
  const [newExceptionIsClosed, setNewExceptionIsClosed] = useState(true);
  const [newExceptionStart, setNewExceptionStart] = useState("10:00");
  const [newExceptionEnd, setNewExceptionEnd] = useState("18:00");
  const [exceptionPending, startExceptionTransition] = useTransition();
  const [exceptionError, setExceptionError] = useState<string | null>(null);

  const [deletePending, startDeleteTransition] = useTransition();
  const [archivePending, startArchiveTransition] = useTransition();

  useEffect(() => {
    if (profileState?.ok) {
      router.refresh();
    }
  }, [profileState, router]);

  function handleSaveSchedule() {
    setScheduleMessage(null);
    startScheduleTransition(async () => {
      const payload: { weekday: number; startMinute: number; endMinute: number }[] = [];
      for (const w of WEEKDAYS) {
        const item = scheduleState[w.id];
        if (item && item.active) {
          const startMinute = timeStringToMinutes(item.start);
          const endMinute = timeStringToMinutes(item.end);
          if (endMinute <= startMinute) {
            setScheduleMessage({ error: `В ${w.label.toLowerCase()} время окончания должно быть позже начала` });
            return;
          }
          payload.push({ weekday: w.id, startMinute, endMinute });
        }
      }

      const res = await saveScheduleAction(member.id, JSON.stringify(payload));
      if (res?.error) {
        setScheduleMessage({ error: res.error });
      } else {
        setScheduleMessage({ ok: true });
        router.refresh();
      }
    });
  }

  function handleAddException(e: React.FormEvent) {
    e.preventDefault();
    setExceptionError(null);
    startExceptionTransition(async () => {
      const res = await addScheduleExceptionAction({
        staffId: member.id,
        date: newExceptionDate,
        isClosed: newExceptionIsClosed,
        startMinute: newExceptionIsClosed ? undefined : timeStringToMinutes(newExceptionStart),
        endMinute: newExceptionIsClosed ? undefined : timeStringToMinutes(newExceptionEnd),
      });

      if (res?.error) {
        setExceptionError(res.error);
      } else {
        router.refresh();
      }
    });
  }

  function handleDeleteException(exceptionId: string) {
    startExceptionTransition(async () => {
      await deleteScheduleExceptionAction(exceptionId, member.id);
      router.refresh();
    });
  }

  function handleToggleArchive() {
    startArchiveTransition(async () => {
      await toggleStaffAction(member.id, !member.isActive);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm(`Вы действительно хотите удалить мастера ${member.name}? Если у мастера есть история записей, рекомендуется переместить его в архив.`)) {
      return;
    }
    startDeleteTransition(async () => {
      const res = await deleteStaffAction(member.id);
      if (res?.error) {
        alert(res.error);
      } else {
        router.push("/dashboard/staff");
      }
    });
  }

  function toggleAllServices() {
    if (selectedServices.length === services.length) {
      setSelectedServices([]);
    } else {
      setSelectedServices(services.map((s) => s.id));
    }
  }

  return (
    <div className="space-y-6">
      {/* Navigation and Top Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/dashboard/staff"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft size={16} /> Назад к мастерам
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleArchive}
            disabled={archivePending}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[12px] font-medium transition-colors ${
              member.isActive
                ? "border-line bg-paper text-ink hover:bg-black/5"
                : "border-emerald-300 bg-emerald-50 text-emerald-800"
            }`}
          >
            {archivePending ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Archive size={13} />
            )}
            {member.isActive ? "В архив (скрыть)" : "Восстановить из архива"}
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={deletePending}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose/20 bg-rose/5 px-3 py-1.5 text-[12px] font-medium text-rose transition-colors hover:bg-rose/10 disabled:opacity-50"
          >
            {deletePending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Удалить
          </button>
        </div>
      </div>

      {/* Staff Summary Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-xs">
            <span className="text-[11px] font-medium text-muted">Выручка мастера</span>
            <p className="mt-1 text-xl font-bold tracking-tight text-emerald-700">
              {formatMoney(stats.totalRevenue, currency)}
            </p>
            <span className="text-[10px] text-muted">Завершённые визиты</span>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4 shadow-xs">
            <span className="text-[11px] font-medium text-muted">Визитов</span>
            <p className="mt-1 text-xl font-bold tracking-tight text-ink">{stats.completedVisits}</p>
            <span className="text-[10px] text-muted">Из {stats.totalBookings} записей</span>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4 shadow-xs">
            <span className="text-[11px] font-medium text-muted">Часов работы</span>
            <p className="mt-1 text-xl font-bold tracking-tight text-ink">{stats.totalHours} ч</p>
            <span className="text-[10px] text-muted">Нагрузка по услугам</span>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4 shadow-xs">
            <span className="text-[11px] font-medium text-muted">Статус мастера</span>
            <p className="mt-1 flex items-center gap-1.5 text-base font-bold text-ink">
              <span
                className={`size-2.5 rounded-full ${
                  member.isActive ? "bg-emerald-500" : "bg-zinc-400"
                }`}
              />
              {member.isActive ? "Активен" : "В архиве"}
            </p>
            <span className="text-[10px] text-muted">
              {member.isActive ? "Доступен для записи" : "Скрыт из формы"}
            </span>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile Card */}
        <div className="rounded-[24px] bg-white p-6 ring-1 ring-line/80">
          <h2 className="text-[17px] font-semibold">Профиль мастера</h2>
          <p className="mt-1 text-[12.5px] text-muted">
            Имя, специализация, цвет и привязка к услугам.
          </p>

          <form action={profileFormAction} className="mt-5 space-y-4">
            <input type="hidden" name="id" value={member.id} />

            <div>
              <label htmlFor="staff-name" className="label-base">
                Имя
              </label>
              <input
                id="staff-name"
                name="name"
                defaultValue={member.name}
                className="input-base"
                required
              />
            </div>

            <div>
              <label htmlFor="staff-title" className="label-base">
                Должность / Специализация
              </label>
              <input
                id="staff-title"
                name="title"
                defaultValue={member.title || ""}
                placeholder="Топ-стилист, Барбер, Мастер маникюра"
                className="input-base"
              />
            </div>

            <div>
              <label htmlFor="staff-bio" className="label-base">
                О мастере
              </label>
              <textarea
                id="staff-bio"
                name="bio"
                defaultValue={member.bio || ""}
                rows={3}
                placeholder="Опыт, подход, дипломы..."
                className="input-base resize-none"
              />
            </div>

            <div>
              <label className="label-base">Цвет в календаре</label>
              <div className="mt-2 flex items-center gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedColor(c)}
                    className={`size-7 rounded-full transition-transform ${
                      selectedColor === c
                        ? "scale-110 ring-2 ring-ink ring-offset-2"
                        : "hover:scale-105"
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
              <input type="hidden" name="color" value={selectedColor} />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="staff-active"
                name="isActive"
                defaultChecked={member.isActive}
                className="size-4 rounded border-line accent-brand"
              />
              <label htmlFor="staff-active" className="text-xs font-medium text-ink cursor-pointer">
                Мастер активен и отображается для онлайн-записи
              </label>
            </div>

            <div>
              <div className="flex items-center justify-between pb-1">
                <label className="label-base">Услуги мастера</label>
                <button
                  type="button"
                  onClick={toggleAllServices}
                  className="text-[11px] font-medium text-brand hover:underline"
                >
                  {selectedServices.length === services.length ? "Снять все" : "Выбрать все"}
                </button>
              </div>

              {services.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line p-3 text-center text-[12px] text-muted">
                  Услуги ещё не созданы.
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto rounded-xl border border-line bg-paper/30 p-2 space-y-1">
                  {services.map((service) => {
                    const checked = selectedServices.includes(service.id);
                    return (
                      <label
                        key={service.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg p-1.5 text-[12.5px] hover:bg-paper"
                      >
                        <input
                          type="checkbox"
                          name="serviceIds"
                          value={service.id}
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedServices((prev) => [...prev, service.id]);
                            } else {
                              setSelectedServices((prev) => prev.filter((id) => id !== service.id));
                            }
                          }}
                          className="size-4 rounded border-line accent-brand"
                        />
                        <span className="truncate">{service.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {profileState?.error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-[12.5px] text-rose-700">
                {profileState.error}
              </div>
            )}

            {profileState?.ok && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-[12.5px] text-emerald-700">
                Профиль успешно сохранён
              </div>
            )}

            <button
              type="submit"
              disabled={profilePending}
              className="btn btn-primary w-full h-10 text-[13px]"
            >
              {profilePending ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                "Сохранить профиль"
              )}
            </button>
          </form>
        </div>

        {/* Schedule & Exceptions */}
        <div className="space-y-6">
          {/* Weekly Schedule */}
          <div className="rounded-[24px] bg-white p-6 ring-1 ring-line/80">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[17px] font-semibold">Недельное расписание</h2>
                <p className="mt-1 text-[12.5px] text-muted">
                  Регулярные рабочие дни и смены мастера.
                </p>
              </div>
              <Clock size={18} strokeWidth={1.6} className="text-muted" />
            </div>

            <div className="mt-4 space-y-2.5">
              {WEEKDAYS.map((w) => {
                const item = scheduleState[w.id];
                return (
                  <div
                    key={w.id}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-2.5 transition-colors ${
                      item?.active
                        ? "border-line bg-white"
                        : "border-transparent bg-paper/60 opacity-60"
                    }`}
                  >
                    <label className="flex cursor-pointer items-center gap-2 min-w-[110px]">
                      <input
                        type="checkbox"
                        checked={item?.active ?? false}
                        onChange={(e) =>
                          setScheduleState((prev) => ({
                            ...prev,
                            [w.id]: { ...prev[w.id], active: e.target.checked },
                          }))
                        }
                        className="size-4 rounded border-line accent-brand"
                      />
                      <span className="text-[12.5px] font-medium">{w.label}</span>
                    </label>

                    {item?.active ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="time"
                          value={item.start}
                          onChange={(e) =>
                            setScheduleState((prev) => ({
                              ...prev,
                              [w.id]: { ...prev[w.id], start: e.target.value },
                            }))
                          }
                          className="rounded-lg border border-line bg-paper px-2 py-1 text-[12px] outline-none focus:border-brand"
                        />
                        <span className="text-muted text-[11px]">—</span>
                        <input
                          type="time"
                          value={item.end}
                          onChange={(e) =>
                            setScheduleState((prev) => ({
                              ...prev,
                              [w.id]: { ...prev[w.id], end: e.target.value },
                            }))
                          }
                          className="rounded-lg border border-line bg-paper px-2 py-1 text-[12px] outline-none focus:border-brand"
                        />
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted">Выходной</span>
                    )}
                  </div>
                );
              })}
            </div>

            {scheduleMessage?.error && (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
                {scheduleMessage.error}
              </div>
            )}

            {scheduleMessage?.ok && (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700">
                Расписание успешно сохранено
              </div>
            )}

            <button
              type="button"
              onClick={handleSaveSchedule}
              disabled={schedulePending}
              className="btn btn-primary mt-4 w-full h-9 text-xs"
            >
              {schedulePending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <>
                  <Save size={13} /> Сохранить расписание
                </>
              )}
            </button>
          </div>

          {/* Exceptions & Day Offs */}
          <div className="rounded-[24px] bg-white p-6 ring-1 ring-line/80">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[17px] font-semibold">Исключения и отпуска</h2>
                <p className="mt-1 text-[12.5px] text-muted">
                  Больничные, отпуска или внеплановые смены на конкретную дату.
                </p>
              </div>
              <CalendarOff size={18} strokeWidth={1.6} className="text-muted" />
            </div>

            {/* List of current exceptions */}
            <div className="mt-4 space-y-2">
              {exceptions.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line p-3 text-center text-xs text-muted">
                  Исключений нет. Мастер работает строго по недельному графику.
                </p>
              ) : (
                <div className="divide-y divide-line rounded-xl border border-line bg-paper/40">
                  {exceptions.map((ex) => (
                    <div
                      key={ex.id}
                      className="flex items-center justify-between p-2.5 text-xs"
                    >
                      <div>
                        <span className="font-semibold text-ink">{ex.date}</span>
                        <span className="ml-2">
                          {ex.isClosed ? (
                            <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-800">
                              Выходной / Отпуск
                            </span>
                          ) : (
                            <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-800">
                              Смена: {minutesToTimeString(ex.startMinute || 0)} —{" "}
                              {minutesToTimeString(ex.endMinute || 0)}
                            </span>
                          )}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteException(ex.id)}
                        disabled={exceptionPending}
                        className="text-muted hover:text-rose-600"
                        title="Удалить исключение"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Form to add exception */}
            <form onSubmit={handleAddException} className="mt-4 rounded-xl border border-line bg-paper/60 p-3 space-y-3 text-xs">
              <span className="font-semibold text-ink flex items-center gap-1.5">
                <Plus size={13} /> Добавить исключение
              </span>

              {exceptionError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700">
                  {exceptionError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-muted">Дата</label>
                  <input
                    type="date"
                    value={newExceptionDate}
                    onChange={(e) => setNewExceptionDate(e.target.value)}
                    className="mt-1 h-8 w-full rounded-lg border border-line bg-white px-2 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted">Тип исключения</label>
                  <select
                    value={newExceptionIsClosed ? "closed" : "custom"}
                    onChange={(e) => setNewExceptionIsClosed(e.target.value === "closed")}
                    className="mt-1 h-8 w-full rounded-lg border border-line bg-white px-2 text-xs"
                  >
                    <option value="closed">Выходной / Отпуск</option>
                    <option value="custom">Особые часы смены</option>
                  </select>
                </div>
              </div>

              {!newExceptionIsClosed && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-muted">Начало</label>
                    <input
                      type="time"
                      value={newExceptionStart}
                      onChange={(e) => setNewExceptionStart(e.target.value)}
                      className="mt-1 h-8 w-full rounded-lg border border-line bg-white px-2 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted">Конец</label>
                    <input
                      type="time"
                      value={newExceptionEnd}
                      onChange={(e) => setNewExceptionEnd(e.target.value)}
                      className="mt-1 h-8 w-full rounded-lg border border-line bg-white px-2 text-xs"
                      required
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={exceptionPending}
                className="btn btn-secondary h-8 w-full text-xs font-medium"
              >
                {exceptionPending ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  "Применить исключение"
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
