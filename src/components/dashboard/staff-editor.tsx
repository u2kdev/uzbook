"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, Loader2, Save, Trash2 } from "lucide-react";
import {
  deleteStaffAction,
  saveScheduleAction,
  updateStaffAction,
  type ActionState,
} from "@/server/actions/catalog";

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

export type ServiceOption = {
  id: string;
  name: string;
  isActive: boolean;
};

export function StaffEditor({
  member,
  services,
  schedule,
}: {
  member: StaffMemberData;
  services: ServiceOption[];
  schedule: WorkingHourData[];
}) {
  const router = useRouter();
  const [profileState, profileFormAction, profilePending] = useActionState<ActionState, FormData>(
    updateStaffAction,
    null,
  );
  const [selectedColor, setSelectedColor] = useState(member.color || COLORS[0]);
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
  const [deletePending, startDeleteTransition] = useTransition();

  useEffect(() => {
    if (profileState?.ok) {
      router.refresh();
    }
  }, [profileState, router]);

  const handleSaveSchedule = () => {
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
  };

  const handleDelete = () => {
    if (!confirm(`Вы действительно хотите удалить мастера ${member.name}?`)) return;
    startDeleteTransition(async () => {
      const res = await deleteStaffAction(member.id);
      if (res?.error) {
        alert(res.error);
      } else {
        router.push("/dashboard/staff");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/dashboard/staff"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft size={16} /> Назад к мастерам
        </Link>

        <button
          type="button"
          onClick={handleDelete}
          disabled={deletePending}
          className="inline-flex items-center gap-1.5 rounded-xl border border-rose/20 bg-rose/5 px-3 py-1.5 text-[12px] font-medium text-rose transition-colors hover:bg-rose/10 disabled:opacity-50"
        >
          {deletePending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          Удалить мастера
        </button>
      </div>

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
                Специализация
              </label>
              <input
                id="staff-title"
                name="title"
                defaultValue={member.title ?? ""}
                placeholder="Топ-стилист, колорист"
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
                rows={2}
                defaultValue={member.bio ?? ""}
                placeholder="Опыт работы, квалификация..."
                className="input-base py-2"
              />
            </div>

            <div>
              <span className="label-base">Цвет в расписании</span>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setSelectedColor(item)}
                    className={`size-8 rounded-full transition-transform duration-200 ${
                      selectedColor === item ? "scale-110 ring-2 ring-ink ring-offset-2" : ""
                    }`}
                    style={{ background: item }}
                    aria-label={item}
                  />
                ))}
                <input type="hidden" name="color" value={selectedColor} />
              </div>
            </div>

            <div className="pt-1">
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  name="isActive"
                  defaultChecked={member.isActive}
                  className="size-4 rounded border-line accent-[var(--color-brand)]"
                />
                <span className="text-[13px] font-medium">Принимает записи (активен)</span>
              </label>
            </div>

            <div className="pt-2">
              <span className="label-base">Оказываемые услуги</span>
              {services.length === 0 ? (
                <p className="rounded-xl bg-paper px-3 py-2 text-[12px] text-muted">
                  В каталоге пока нет услуг.
                </p>
              ) : (
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
                  {services.map((service) => {
                    const checked = member.serviceIds.includes(service.id);
                    return (
                      <label
                        key={service.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] hover:bg-paper"
                      >
                        <input
                          type="checkbox"
                          name="serviceIds"
                          value={service.id}
                          defaultChecked={checked}
                          className="size-4 rounded border-line accent-[var(--color-brand)]"
                        />
                        <span className="truncate">{service.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {profileState?.error && (
              <div className="rounded-xl border border-rose/20 bg-rose/5 px-3.5 py-2 text-[12.5px] text-rose">
                {profileState.error}
              </div>
            )}

            {profileState?.ok && (
              <div className="rounded-xl border border-mint/20 bg-mint/5 px-3.5 py-2 text-[12.5px] text-mint">
                Профиль успешно сохранён
              </div>
            )}

            <button type="submit" disabled={profilePending} className="btn btn-primary w-full h-10 text-[13px]">
              {profilePending ? <Loader2 size={15} className="animate-spin" /> : "Сохранить профиль"}
            </button>
          </form>
        </div>

        {/* Schedule Card */}
        <div className="rounded-[24px] bg-white p-6 ring-1 ring-line/80">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[17px] font-semibold">Рабочее расписание</h2>
              <p className="mt-1 text-[12.5px] text-muted">
                Дни и часы, когда мастер доступен для онлайн-записи.
              </p>
            </div>
            <Clock size={18} strokeWidth={1.6} className="text-muted" />
          </div>

          <div className="mt-5 space-y-3">
            {WEEKDAYS.map((w) => {
              const item = scheduleState[w.id];
              return (
                <div
                  key={w.id}
                  className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors ${
                    item?.active ? "border-line bg-white" : "border-transparent bg-paper/60 opacity-60"
                  }`}
                >
                  <label className="flex cursor-pointer items-center gap-2.5 min-w-[120px]">
                    <input
                      type="checkbox"
                      checked={item?.active ?? false}
                      onChange={(e) =>
                        setScheduleState((prev) => ({
                          ...prev,
                          [w.id]: { ...prev[w.id], active: e.target.checked },
                        }))
                      }
                      className="size-4 rounded border-line accent-[var(--color-brand)]"
                    />
                    <span className="text-[13px] font-medium">{w.label}</span>
                  </label>

                  {item?.active ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={item.start}
                        onChange={(e) =>
                          setScheduleState((prev) => ({
                            ...prev,
                            [w.id]: { ...prev[w.id], start: e.target.value },
                          }))
                        }
                        className="rounded-lg border border-line bg-paper px-2 py-1 text-[12.5px] outline-none focus:border-brand"
                      />
                      <span className="text-muted text-[12px]">—</span>
                      <input
                        type="time"
                        value={item.end}
                        onChange={(e) =>
                          setScheduleState((prev) => ({
                            ...prev,
                            [w.id]: { ...prev[w.id], end: e.target.value },
                          }))
                        }
                        className="rounded-lg border border-line bg-paper px-2 py-1 text-[12.5px] outline-none focus:border-brand"
                      />
                    </div>
                  ) : (
                    <span className="text-[12px] text-muted">Выходной</span>
                  )}
                </div>
              );
            })}
          </div>

          {scheduleMessage?.error && (
            <div className="mt-4 rounded-xl border border-rose/20 bg-rose/5 px-3.5 py-2 text-[12.5px] text-rose">
              {scheduleMessage.error}
            </div>
          )}

          {scheduleMessage?.ok && (
            <div className="mt-4 rounded-xl border border-mint/20 bg-mint/5 px-3.5 py-2 text-[12.5px] text-mint">
              Расписание успешно сохранено
            </div>
          )}

          <button
            type="button"
            onClick={handleSaveSchedule}
            disabled={schedulePending}
            className="btn btn-primary mt-5 w-full h-10 text-[13px]"
          >
            {schedulePending ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <>
                <Save size={15} /> Сохранить расписание
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
