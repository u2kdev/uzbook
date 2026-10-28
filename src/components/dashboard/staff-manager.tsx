"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Archive, Check, Loader2, Pencil, Plus, TrendingUp, Users, X } from "lucide-react";
import {
  createStaffAction,
  toggleStaffAction,
  type ActionState,
} from "@/server/actions/catalog";
import { formatMoney } from "@/lib/plans";

export type StaffCard = {
  id: string;
  name: string;
  title: string | null;
  color: string;
  isActive: boolean;
  photoUrl: string | null;
  serviceCount: number;
  revenue: number;
  completedCount: number;
};

export type ServiceOption = { id: string; name: string; isActive: boolean };

const COLORS = ["#6e56f8", "#12b886", "#f5a524", "#f04d6a", "#2f9e8f", "#0f8bd6", "#8b5cf6", "#eb6f3f"];

export function StaffManager({
  staff,
  services,
  currency = "UZS",
}: {
  staff: StaffCard[];
  services: ServiceOption[];
  currency?: string;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [filterTab, setFilterTab] = useState<"all" | "active" | "archived">("active");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredStaff = useMemo(() => {
    if (filterTab === "active") return staff.filter((s) => s.isActive);
    if (filterTab === "archived") return staff.filter((s) => !s.isActive);
    return staff;
  }, [staff, filterTab]);

  const activeCount = staff.filter((s) => s.isActive).length;
  const archivedCount = staff.filter((s) => !s.isActive).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">Команда</p>
          <h1 className="mt-1.5 text-[26px] leading-tight font-semibold tracking-[-0.03em]">Мастера</h1>
          <p className="mt-1 text-[12.5px] text-muted">
            График, исключения, услуги и доход по каждому мастеру.
          </p>
        </div>
        <button onClick={() => setCreating(true)} className="btn btn-primary h-10 text-[12.5px]">
          <Plus size={15} strokeWidth={1.8} /> Добавить мастера
        </button>
      </div>

      {/* Filter tabs */}
      {staff.length > 0 && (
        <div className="flex items-center gap-1.5 border-b border-line pb-2">
          <button
            onClick={() => setFilterTab("active")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filterTab === "active" ? "bg-ink text-white" : "text-muted hover:bg-paper hover:text-ink"
            }`}
          >
            <span>Активные</span>
            <span className="rounded-full bg-black/10 px-1.5 py-0.2 text-[10px]">{activeCount}</span>
          </button>
          <button
            onClick={() => setFilterTab("archived")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filterTab === "archived" ? "bg-ink text-white" : "text-muted hover:bg-paper hover:text-ink"
            }`}
          >
            <span>В архиве</span>
            <span className="rounded-full bg-black/10 px-1.5 py-0.2 text-[10px]">{archivedCount}</span>
          </button>
          <button
            onClick={() => setFilterTab("all")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filterTab === "all" ? "bg-ink text-white" : "text-muted hover:bg-paper hover:text-ink"
            }`}
          >
            <span>Все</span>
            <span className="rounded-full bg-black/10 px-1.5 py-0.2 text-[10px]">{staff.length}</span>
          </button>
        </div>
      )}

      {filteredStaff.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-line bg-white/60 px-6 py-14 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
            <Users size={20} strokeWidth={1.5} />
          </span>
          <p className="mt-4 text-[15px] font-semibold">
            {filterTab === "archived" ? "В архиве нет мастеров" : "Добавьте первого мастера"}
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-muted">
            {filterTab === "archived"
              ? "Здесь будут отображаться мастера, которые временно отключены от записи без удаления истории визитов."
              : "Укажите имя, услуги и рабочие часы — клиенты увидят свободное время и смогут записаться."}
          </p>
          {filterTab !== "archived" && (
            <button onClick={() => setCreating(true)} className="btn btn-primary mt-5 h-10 text-[12.5px]">
              <Plus size={15} /> Добавить мастера
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredStaff.map((member) => (
            <div
              key={member.id}
              className={`group relative rounded-[20px] bg-white p-4 ring-1 ring-line/80 transition-all duration-300 hover:shadow-soft ${
                member.isActive ? "" : "bg-paper/40 opacity-75"
              }`}
            >
              <Link href={`/dashboard/staff/${member.id}`} className="block">
                <div className="flex items-start gap-3">
                  <span
                    className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full text-[14px] font-semibold text-white"
                    style={{ background: member.color }}
                  >
                    {member.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={member.photoUrl} alt={member.name} className="size-full object-cover" />
                    ) : (
                      member.name.slice(0, 1)
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[14px] font-semibold">{member.name}</p>
                      {!member.isActive && (
                        <span className="rounded bg-zinc-200 px-1.5 py-0.2 text-[10px] font-medium text-zinc-700">
                          В архиве
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[11.5px] text-muted">{member.title || "Мастер"}</p>
                  </div>
                  <Pencil
                    size={14}
                    className="mt-1 text-muted opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </div>

                {/* Metrics: services count, visits, revenue */}
                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line/60 pt-3 text-[11.5px]">
                  <div>
                    <span className="text-muted">Записей:</span>{" "}
                    <span className="font-semibold text-ink">{member.completedCount}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-muted">Доход:</span>{" "}
                    <span className="font-semibold text-emerald-700">
                      {formatMoney(member.revenue, currency)}
                    </span>
                  </div>
                </div>
              </Link>

              {/* Quick toggle active/archive button */}
              <div className="mt-3 flex items-center justify-between border-t border-line/40 pt-2 text-[11px]">
                <span className="rounded-full bg-paper px-2 py-0.5 text-muted">
                  {member.serviceCount} услуг привязано
                </span>
                <button
                  type="button"
                  disabled={pendingId === member.id}
                  onClick={(e) => {
                    e.preventDefault();
                    setPendingId(member.id);
                    startTransition(async () => {
                      await toggleStaffAction(member.id, !member.isActive);
                      setPendingId(null);
                      router.refresh();
                    });
                  }}
                  className="flex items-center gap-1 font-medium text-muted hover:text-ink"
                  title={member.isActive ? "Переместить в архив (скрыть из записи)" : "Восстановить мастера"}
                >
                  {pendingId === member.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Archive size={12} />
                  )}
                  {member.isActive ? "В архив" : "Восстановить"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && (
        <CreateStaffModal
          services={services}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function CreateStaffModal({
  services,
  onClose,
  onCreated,
}: {
  services: ServiceOption[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createStaffAction,
    null,
  );
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [selectAll, setSelectAll] = useState(true);
  const [selectedServices, setSelectedServices] = useState<string[]>(() =>
    services.map((s) => s.id),
  );

  useEffect(() => {
    if (state?.ok) onCreated();
  }, [state, onCreated]);

  function toggleAllServices() {
    if (selectedServices.length === services.length) {
      setSelectedServices([]);
      setSelectAll(false);
    } else {
      setSelectedServices(services.map((s) => s.id));
      setSelectAll(true);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Закрыть"
      />
      <div className="relative z-10 max-h-[92dvh] w-full max-w-[500px] overflow-y-auto rounded-t-[28px] bg-white p-6 shadow-lift animate-rise sm:rounded-[28px]">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-[18px] font-semibold">Новый мастер</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              Добавьте специалиста и выберите услуги, которые он выполняет.
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-full text-muted hover:bg-paper hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        <form action={formAction} className="space-y-4">
          <div>
            <label className="label-base">Имя мастера *</label>
            <input
              name="name"
              placeholder="Например, Алина"
              className="input-base"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="label-base">Должность / Специализация</label>
            <input
              name="title"
              placeholder="Например, Топ-стилист, Барбер"
              className="input-base"
            />
          </div>

          <div>
            <label className="label-base">О мастере (био)</label>
            <textarea
              name="bio"
              rows={2}
              placeholder="Опыт, сертификаты, стиль работы..."
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
                    selectedColor === c ? "scale-110 ring-2 ring-ink ring-offset-2" : "hover:scale-105"
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
            <input type="hidden" name="color" value={selectedColor} />
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
                Услуги ещё не созданы. Вы сможете привязать их позже.
              </p>
            ) : (
              <div className="max-h-40 overflow-y-auto rounded-xl border border-line bg-paper/30 p-2 space-y-1">
                {services.map((s) => {
                  const checked = selectedServices.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg p-1.5 text-[12px] hover:bg-paper"
                    >
                      <input
                        type="checkbox"
                        name="serviceIds"
                        value={s.id}
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedServices((prev) => [...prev, s.id]);
                          } else {
                            setSelectedServices((prev) => prev.filter((id) => id !== s.id));
                          }
                        }}
                        className="size-4 rounded border-line accent-brand"
                      />
                      <span className="truncate">{s.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {state?.error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-[12px] text-rose-700">
              {state.error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-ghost h-9 text-xs">
              Отмена
            </button>
            <button
              type="submit"
              disabled={pending}
              className="btn btn-primary h-9 gap-1.5 px-4 text-xs font-semibold"
            >
              {pending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Создать мастера
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
