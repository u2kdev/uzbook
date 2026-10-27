"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Loader2, Pencil, Plus, Scissors, Trash2, X } from "lucide-react";
import { useActionState } from "react";
import {
  createServiceAction,
  deleteServiceAction,
  toggleServiceAction,
  updateServiceAction,
  type ActionState,
} from "@/server/actions/catalog";
import { formatMoney } from "@/lib/plans";

export type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  durationMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  price: number;
  isActive: boolean;
};

function durationLabel(minutes: number) {
  if (minutes < 60) return `${minutes} мин`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

export function ServicesManager({
  services,
  currency,
}: {
  services: ServiceRow[];
  currency: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<ServiceRow | "new" | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">
            Каталог
          </p>
          <h1 className="mt-1.5 text-[26px] leading-tight font-semibold tracking-[-0.03em]">
            Услуги и цены
          </h1>
          <p className="mt-1 text-[12.5px] text-muted">
            Длительность влияет на свободные слоты — указывайте её точно.
          </p>
        </div>
        <button onClick={() => setEditing("new")} className="btn btn-primary h-10 text-[12.5px]">
          <Plus size={15} strokeWidth={1.8} /> Добавить услугу
        </button>
      </div>

      {services.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-line bg-white/60 px-6 py-14 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
            <Scissors size={20} strokeWidth={1.5} />
          </span>
          <p className="mt-4 text-[15px] font-semibold">Пока пусто</p>
          <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-muted">
            Добавьте услуги с ценой и длительностью. Клиент увидит их на вашей странице и сможет
            выбрать при записи.
          </p>
          <button onClick={() => setEditing("new")} className="btn btn-primary mt-5 h-10 text-[12.5px]">
            <Plus size={15} /> Первая услуга
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[20px] bg-white ring-1 ring-line/80">
          {services.map((service, index) => (
            <div
              key={service.id}
              className={`flex flex-wrap items-center gap-3 px-4 py-3.5 transition-colors hover:bg-paper/60 ${
                index > 0 ? "border-t border-line/70" : ""
              } ${service.isActive ? "" : "opacity-55"}`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold">{service.name}</p>
                <p className="mt-0.5 flex items-center gap-2 text-[11.5px] text-muted">
                  <Clock3 size={12} strokeWidth={1.6} />
                  {durationLabel(service.durationMin)}
                  {service.category ? <span>· {service.category}</span> : null}
                </p>
              </div>

              <p className="text-[13px] font-semibold tabular-nums">
                {formatMoney(service.price, currency)}
              </p>

              <button
                onClick={() =>
                  startTransition(async () => {
                    await toggleServiceAction(service.id, !service.isActive);
                    router.refresh();
                  })
                }
                disabled={pending}
                className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-300 ${
                  service.isActive ? "bg-mint" : "bg-line"
                }`}
                title={service.isActive ? "Скрыть с сайта" : "Показать на сайте"}
                aria-label="Показать услугу"
              >
                <span
                  className={`absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                    service.isActive ? "translate-x-[18px]" : "translate-x-0.5"
                  }`}
                />
              </button>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEditing(service)}
                  className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-paper hover:text-ink"
                  title="Редактировать"
                >
                  <Pencil size={14} strokeWidth={1.6} />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Удалить «${service.name}»?`)) {
                      startTransition(async () => {
                        await deleteServiceAction(service.id);
                        router.refresh();
                      });
                    }
                  }}
                  className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-rose/5 hover:text-rose"
                  title="Удалить"
                >
                  <Trash2 size={14} strokeWidth={1.6} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button
            className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]"
            onClick={() => setEditing(null)}
            aria-label="Закрыть"
          />
          <div className="relative z-10 max-h-[92dvh] w-full max-w-[520px] overflow-y-auto rounded-t-[28px] bg-white p-6 shadow-lift animate-rise sm:rounded-[28px]">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-[18px] font-semibold">
                  {editing === "new" ? "Новая услуга" : "Изменить услугу"}
                </h2>
                <p className="mt-1 text-[12px] text-muted">
                  Цена и длительность видны клиенту на странице записи.
                </p>
              </div>
              <button
                onClick={() => setEditing(null)}
                className="grid size-8 place-items-center rounded-lg bg-paper text-muted"
                aria-label="Закрыть"
              >
                <X size={16} strokeWidth={1.6} />
              </button>
            </div>

            <ServiceForm
              service={editing === "new" ? null : editing}
              currency={currency}
              onDone={() => {
                setEditing(null);
                router.refresh();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceForm({
  service,
  currency,
  onDone,
}: {
  service: ServiceRow | null;
  currency: string;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    service ? updateServiceAction : createServiceAction,
    null,
  );
  const [duration, setDuration] = useState(service?.durationMin ?? 60);

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} className="space-y-4">
      {service && <input type="hidden" name="id" value={service.id} />}

      <div>
        <label className="label-base" htmlFor="name">
          Название
        </label>
        <input
          id="name"
          name="name"
          className="input-base"
          defaultValue={service?.name ?? ""}
          placeholder="Женская стрижка"
          required
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-base" htmlFor="durationMin">
            Длительность
          </label>
          <div className="relative">
            <input
              id="durationMin"
              name="durationMin"
              type="number"
              min={5}
              max={720}
              step={5}
              className="input-base pr-12"
              value={duration}
              onChange={(event) => setDuration(Number(event.target.value))}
              required
            />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[11.5px] text-muted">
              мин
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {[30, 45, 60, 90, 120, 180].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setDuration(preset)}
                className={`rounded-md px-1.5 py-0.5 text-[10.5px] transition-colors ${
                  duration === preset ? "bg-ink text-white" : "bg-paper text-muted hover:text-ink"
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label-base" htmlFor="price">
            Цена
          </label>
          <div className="relative">
            <input
              id="price"
              name="price"
              type="number"
              min={0}
              step={1000}
              className="input-base pr-12"
              defaultValue={service?.price ?? 0}
              required
            />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[11.5px] text-muted">
              {currency}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-base" htmlFor="bufferBeforeMin">
            Перерыв до
          </label>
          <input
            id="bufferBeforeMin"
            name="bufferBeforeMin"
            type="number"
            min={0}
            max={120}
            step={5}
            className="input-base"
            defaultValue={service?.bufferBeforeMin ?? 0}
          />
        </div>
        <div>
          <label className="label-base" htmlFor="bufferAfterMin">
            Перерыв после
          </label>
          <input
            id="bufferAfterMin"
            name="bufferAfterMin"
            type="number"
            min={0}
            max={120}
            step={5}
            className="input-base"
            defaultValue={service?.bufferAfterMin ?? 10}
          />
        </div>
      </div>

      <div>
        <label className="label-base" htmlFor="category">
          Категория <span className="font-normal normal-case text-muted">(необязательно)</span>
        </label>
        <input
          id="category"
          name="category"
          className="input-base"
          defaultValue={service?.category ?? ""}
          placeholder="Волосы, ногти, уход"
        />
      </div>

      <div>
        <label className="label-base" htmlFor="description">
          Описание <span className="font-normal normal-case text-muted">(необязательно)</span>
        </label>
        <textarea
          id="description"
          name="description"
          className="input-base h-20 resize-none py-2.5"
          defaultValue={service?.description ?? ""}
          placeholder="Что входит в услугу"
        />
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-[12.5px]">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={service?.isActive ?? true}
          className="size-4 rounded border-line accent-[var(--color-brand)]"
        />
        Показывать на странице записи
      </label>

      {state?.error && (
        <div className="rounded-xl border border-rose/20 bg-rose/5 px-3.5 py-2.5 text-[12.5px] text-rose">
          {state.error}
        </div>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? <Loader2 size={16} className="animate-spin" /> : "Сохранить"}
      </button>
    </form>
  );
}
