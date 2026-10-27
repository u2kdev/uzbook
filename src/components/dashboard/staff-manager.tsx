"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Loader2, Pencil, Plus, Users, X } from "lucide-react";
import {
  createStaffAction,
  toggleServiceAction,
  type ActionState,
} from "@/server/actions/catalog";

export type StaffCard = {
  id: string;
  name: string;
  title: string | null;
  color: string;
  isActive: boolean;
  photoUrl: string | null;
  serviceCount: number;
};

export type ServiceOption = { id: string; name: string; isActive: boolean };

const COLORS = ["#6e56f8", "#12b886", "#f5a524", "#f04d6a", "#2f9e8f", "#0f8bd6", "#8b5cf6", "#eb6f3f"];

export function StaffManager({
  staff,
  services,
}: {
  staff: StaffCard[];
  services: ServiceOption[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">Команда</p>
          <h1 className="mt-1.5 text-[26px] leading-tight font-semibold tracking-[-0.03em]">Мастера</h1>
          <p className="mt-1 text-[12.5px] text-muted">
            График и услуги каждого мастера влияют на доступные слоты.
          </p>
        </div>
        <button onClick={() => setCreating(true)} className="btn btn-primary h-10 text-[12.5px]">
          <Plus size={15} strokeWidth={1.8} /> Добавить мастера
        </button>
      </div>

      {staff.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-line bg-white/60 px-6 py-14 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
            <Users size={20} strokeWidth={1.5} />
          </span>
          <p className="mt-4 text-[15px] font-semibold">Добавьте первого мастера</p>
          <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-muted">
            Укажите имя, услуги и рабочие часы — клиенты увидят свободное время и смогут записаться.
          </p>
          <button onClick={() => setCreating(true)} className="btn btn-primary mt-5 h-10 text-[12.5px]">
            <Plus size={15} /> Добавить мастера
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {staff.map((member) => (
            <Link
              key={member.id}
              href={`/dashboard/staff/${member.id}`}
              className={`group rounded-[20px] bg-white p-4 ring-1 ring-line/80 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:shadow-soft ${
                member.isActive ? "" : "opacity-60"
              }`}
            >
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
                  <p className="truncate text-[14px] font-semibold">{member.name}</p>
                  <p className="truncate text-[11.5px] text-muted">{member.title || "Мастер"}</p>
                </div>
                <Pencil
                  size={14}
                  className="mt-1 text-muted opacity-0 transition-opacity group-hover:opacity-100"
                />
              </div>
              <div className="mt-4 flex items-center justify-between text-[11px]">
                <span className="rounded-full bg-paper px-2 py-1 text-muted">
                  {member.serviceCount} услуг
                </span>
                <span className={member.isActive ? "text-mint" : "text-muted"}>
                  {member.isActive ? "принимает" : "скрыт"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <button
            className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]"
            onClick={() => setCreating(false)}
            aria-label="Закрыть"
          />
          <div className="relative z-10 max-h-[92dvh] w-full max-w-[520px] overflow-y-auto rounded-t-[28px] bg-white p-6 shadow-lift animate-rise sm:rounded-[28px]">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-[18px] font-semibold">Новый мастер</h2>
                <p className="mt-1 text-[12px] text-muted">По умолчанию — пн–сб, 10:00–20:00.</p>
              </div>
              <button
                onClick={() => setCreating(false)}
                className="grid size-8 place-items-center rounded-lg bg-paper text-muted"
                aria-label="Закрыть"
              >
                <X size={16} strokeWidth={1.6} />
              </button>
            </div>

            <StaffCreateForm
              services={services}
              onDone={() => {
                setCreating(false);
                router.refresh();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StaffCreateForm({
  services,
  onDone,
}: {
  services: ServiceOption[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createStaffAction, null);
  const [color, setColor] = useState(COLORS[0]);

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="label-base" htmlFor="staff-name">
          Имя
        </label>
        <input id="staff-name" name="name" className="input-base" placeholder="Мадина" required autoFocus />
      </div>

      <div>
        <label className="label-base" htmlFor="staff-title">
          Специализация
        </label>
        <input id="staff-title" name="title" className="input-base" placeholder="Колорист" />
      </div>

      <div>
        <span className="label-base">Цвет в таймлайне</span>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setColor(item)}
              className={`size-8 rounded-full transition-transform duration-200 ${
                color === item ? "scale-110 ring-2 ring-ink ring-offset-2" : ""
              }`}
              style={{ background: item }}
              aria-label={item}
            />
          ))}
          <input type="hidden" name="color" value={color} />
        </div>
      </div>

      <div>
        <span className="label-base">Какие услуги оказывает</span>
        {services.length === 0 ? (
          <p className="rounded-xl bg-paper px-3 py-2.5 text-[12px] text-muted">
            Сначала добавьте услуги в разделе «Услуги».
          </p>
        ) : (
          <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
            {services.map((service) => (
              <label
                key={service.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[12.5px] hover:bg-paper"
              >
                <input
                  type="checkbox"
                  name="serviceIds"
                  value={service.id}
                  className="size-4 rounded border-line accent-[var(--color-brand)]"
                />
                {service.name}
              </label>
            ))}
          </div>
        )}
      </div>

      {state?.error && (
        <div className="rounded-xl border border-rose/20 bg-rose/5 px-3.5 py-2.5 text-[12.5px] text-rose">
          {state.error}
        </div>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? <Loader2 size={16} className="animate-spin" /> : "Добавить мастера"}
      </button>
    </form>
  );
}
