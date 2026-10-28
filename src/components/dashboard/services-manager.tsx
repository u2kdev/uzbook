"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowUpDown,
  Check,
  CheckSquare,
  Clock3,
  Edit2,
  FolderPlus,
  Loader2,
  Pencil,
  Percent,
  Plus,
  Scissors,
  Search,
  Square,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useActionState } from "react";
import {
  bulkUpdateServicesAction,
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

  // Filters & Search
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionOpen, setBulkActionOpen] = useState<"price" | "duration" | "category" | null>(null);
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Bulk form values
  const [priceChangePercent, setPriceChangePercent] = useState<number>(10);
  const [priceFixedValue, setPriceFixedValue] = useState<string>("");
  const [durationChangeMinutes, setDurationChangeMinutes] = useState<number>(15);
  const [newCategoryName, setNewCategoryName] = useState("");

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of services) {
      if (s.category?.trim()) set.add(s.category.trim());
    }
    return [...set].sort();
  }, [services]);

  const activeCount = services.filter((s) => s.isActive).length;
  const archivedCount = services.filter((s) => !s.isActive).length;

  // Filtered services
  const filteredServices = useMemo(() => {
    let result = services;

    if (selectedCategory === "archived") {
      result = result.filter((s) => !s.isActive);
    } else if (selectedCategory === "active") {
      result = result.filter((s) => s.isActive);
    } else if (selectedCategory !== "all") {
      result = result.filter((s) => s.category?.trim() === selectedCategory);
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q) ||
          s.category?.toLowerCase().includes(q),
      );
    }

    return result;
  }, [services, selectedCategory, search]);

  const allFilteredSelected =
    filteredServices.length > 0 && filteredServices.every((s) => selectedIds.includes(s.id));

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredServices.map((s) => s.id));
    }
  }

  function toggleSelectOne(id: string) {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  }

  // Handle bulk action submit
  async function handleApplyBulk() {
    if (selectedIds.length === 0) return;
    setBulkPending(true);
    setBulkError(null);

    try {
      let res: ActionState = null;
      if (bulkActionOpen === "price") {
        if (priceFixedValue.trim()) {
          res = await bulkUpdateServicesAction({
            serviceIds: selectedIds,
            priceFixed: Number(priceFixedValue),
          });
        } else {
          res = await bulkUpdateServicesAction({
            serviceIds: selectedIds,
            pricePercentChange: priceChangePercent,
          });
        }
      } else if (bulkActionOpen === "duration") {
        res = await bulkUpdateServicesAction({
          serviceIds: selectedIds,
          durationChangeMin: durationChangeMinutes,
        });
      } else if (bulkActionOpen === "category") {
        res = await bulkUpdateServicesAction({
          serviceIds: selectedIds,
          category: newCategoryName,
        });
      }

      if (res?.error) {
        setBulkError(res.error);
      } else {
        setBulkActionOpen(null);
        setSelectedIds([]);
        router.refresh();
      }
    } finally {
      setBulkPending(false);
    }
  }

  // Handle bulk toggle active
  function handleBulkToggleActive(isActive: boolean) {
    if (selectedIds.length === 0) return;
    setBulkPending(true);
    startTransition(async () => {
      await bulkUpdateServicesAction({ serviceIds: selectedIds, isActive });
      setBulkPending(false);
      setSelectedIds([]);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">Каталог</p>
          <h1 className="mt-1.5 text-[26px] leading-tight font-semibold tracking-[-0.03em]">
            Услуги и цены
          </h1>
          <p className="mt-1 text-[12.5px] text-muted">
            Категории, буферы до/после, массовое редактирование и архив без потери истории.
          </p>
        </div>
        <button onClick={() => setEditing("new")} className="btn btn-primary h-10 text-[12.5px]">
          <Plus size={15} strokeWidth={1.8} /> Добавить услугу
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по услугам..."
            className="h-9 w-full rounded-xl border border-line bg-paper pr-3 pl-8 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted hover:text-ink"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              selectedCategory === "all" ? "bg-ink text-white" : "text-muted hover:bg-paper hover:text-ink"
            }`}
          >
            Все ({services.length})
          </button>
          <button
            onClick={() => setSelectedCategory("active")}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              selectedCategory === "active" ? "bg-ink text-white" : "text-muted hover:bg-paper hover:text-ink"
            }`}
          >
            Активные ({activeCount})
          </button>
          <button
            onClick={() => setSelectedCategory("archived")}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              selectedCategory === "archived" ? "bg-ink text-white" : "text-muted hover:bg-paper hover:text-ink"
            }`}
          >
            В архиве ({archivedCount})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                selectedCategory === cat ? "bg-ink text-white" : "text-muted hover:bg-paper hover:text-ink"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Action Bar (Visible when items selected) */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand/30 bg-brand/5 p-3 text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-brand">Выбрано: {selectedIds.length}</span>
            <button
              onClick={() => setSelectedIds([])}
              className="text-[11px] text-muted hover:text-ink underline"
            >
              Снять выбор
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setBulkActionOpen("price")}
              className="btn btn-secondary h-8 gap-1 px-2.5 text-[11px]"
            >
              <Percent size={12} /> Изменить цены
            </button>
            <button
              onClick={() => setBulkActionOpen("duration")}
              className="btn btn-secondary h-8 gap-1 px-2.5 text-[11px]"
            >
              <Clock3 size={12} /> Изменить длительность
            </button>
            <button
              onClick={() => setBulkActionOpen("category")}
              className="btn btn-secondary h-8 gap-1 px-2.5 text-[11px]"
            >
              <Tag size={12} /> Категория
            </button>
            <button
              onClick={() => handleBulkToggleActive(true)}
              disabled={bulkPending}
              className="btn btn-secondary h-8 px-2.5 text-[11px] text-emerald-700"
            >
              Активировать
            </button>
            <button
              onClick={() => handleBulkToggleActive(false)}
              disabled={bulkPending}
              className="btn btn-secondary h-8 px-2.5 text-[11px] text-zinc-600"
            >
              В архив
            </button>
          </div>
        </div>
      )}

      {/* Services List / Table */}
      {filteredServices.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-line bg-white/60 px-6 py-14 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
            <Scissors size={20} strokeWidth={1.5} />
          </span>
          <p className="mt-4 text-[15px] font-semibold">
            {selectedCategory === "archived" ? "В архиве нет услуг" : "Услуги не найдены"}
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-muted">
            {search
              ? "Попробуйте изменить поисковый запрос."
              : "Добавьте услуги с ценой, длительностью и буферами."}
          </p>
          {selectedCategory !== "archived" && (
            <button onClick={() => setEditing("new")} className="btn btn-primary mt-5 h-10 text-[12.5px]">
              <Plus size={15} /> Первая услуга
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[20px] bg-white ring-1 ring-line/80">
          {/* Header Row with Select All */}
          <div className="flex items-center gap-3 border-b border-line bg-paper/40 px-4 py-2.5 text-[11px] font-medium text-muted">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-ink hover:text-brand"
            >
              {allFilteredSelected ? (
                <CheckSquare size={15} className="text-brand" />
              ) : (
                <Square size={15} />
              )}
              <span>Выбрать все ({filteredServices.length})</span>
            </button>
            <span className="flex-1" />
            <span className="w-24 text-right">Цена</span>
            <span className="w-16 text-center">Статус</span>
            <span className="w-16 text-right">Действия</span>
          </div>

          {filteredServices.map((service, index) => {
            const isSelected = selectedIds.includes(service.id);

            return (
              <div
                key={service.id}
                className={`flex flex-wrap items-center gap-3 px-4 py-3.5 transition-colors hover:bg-paper/60 ${
                  index > 0 ? "border-t border-line/70" : ""
                } ${service.isActive ? "" : "bg-paper/30 opacity-65"} ${
                  isSelected ? "bg-brand/5" : ""
                }`}
              >
                {/* Checkbox */}
                <button
                  onClick={() => toggleSelectOne(service.id)}
                  className="text-muted hover:text-brand"
                >
                  {isSelected ? (
                    <CheckSquare size={15} className="text-brand" />
                  ) : (
                    <Square size={15} />
                  )}
                </button>

                {/* Service Details */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[13.5px] font-semibold text-ink">{service.name}</p>
                    {!service.isActive && (
                      <span className="rounded bg-zinc-200 px-1.5 py-0.2 text-[10px] font-medium text-zinc-700">
                        В архиве
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-muted">
                    <span className="flex items-center gap-1">
                      <Clock3 size={12} strokeWidth={1.6} />
                      {durationLabel(service.durationMin)}
                    </span>
                    {(service.bufferBeforeMin > 0 || service.bufferAfterMin > 0) && (
                      <span className="text-[10px] text-ink-soft">
                        (буфер: {service.bufferBeforeMin} мин до / {service.bufferAfterMin} мин после)
                      </span>
                    )}
                    {service.category && (
                      <span className="rounded bg-paper px-1.5 py-0.2 text-[10px] font-medium text-ink">
                        {service.category}
                      </span>
                    )}
                  </p>
                </div>

                {/* Price */}
                <p className="w-24 text-right text-[13px] font-semibold tabular-nums text-ink">
                  {formatMoney(service.price, currency)}
                </p>

                {/* Toggle Active Switch */}
                <div className="w-16 flex justify-center">
                  <button
                    onClick={() =>
                      startTransition(async () => {
                        await toggleServiceAction(service.id, !service.isActive);
                        router.refresh();
                      })
                    }
                    disabled={pending}
                    className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-300 ${
                      service.isActive ? "bg-emerald-500" : "bg-line"
                    }`}
                    title={service.isActive ? "Переместить в архив (скрыть)" : "Восстановить на сайте"}
                    aria-label="Показать услугу"
                  >
                    <span
                      className={`absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                        service.isActive ? "translate-x-[18px]" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>

                {/* Action buttons */}
                <div className="flex w-16 items-center justify-end gap-1">
                  <button
                    onClick={() => setEditing(service)}
                    className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-paper hover:text-ink"
                    title="Редактировать"
                  >
                    <Pencil size={14} strokeWidth={1.6} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Удалить «${service.name}»? Если у услуги есть записи, она переместится в архив без удаления истории.`)) {
                        startTransition(async () => {
                          const res = await deleteServiceAction(service.id);
                          if (res?.error) {
                            alert(res.error);
                          }
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
            );
          })}
        </div>
      )}

      {/* BULK ACTION MODAL */}
      {bulkActionOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-bold text-ink text-sm">
                Массовое редактирование ({selectedIds.length} услуг)
              </h3>
              <button onClick={() => setBulkActionOpen(null)} className="text-muted hover:text-ink">
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              {bulkError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-rose-700">
                  {bulkError}
                </div>
              )}

              {bulkActionOpen === "price" && (
                <div className="space-y-3">
                  <div>
                    <label className="font-semibold text-ink">Изменить цену в процентах</label>
                    <div className="mt-1 flex items-center gap-2">
                      {[-20, -10, 10, 20, 30].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => {
                            setPriceChangePercent(pct);
                            setPriceFixedValue("");
                          }}
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                            priceChangePercent === pct && !priceFixedValue
                              ? "bg-ink text-white"
                              : "bg-paper text-ink hover:bg-black/5"
                          }`}
                        >
                          {pct > 0 ? `+${pct}%` : `${pct}%`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-ink">Или установить фиксированную цену</label>
                    <input
                      type="number"
                      value={priceFixedValue}
                      onChange={(e) => setPriceFixedValue(e.target.value)}
                      placeholder={`Например, 150000 ${currency}`}
                      className="mt-1 h-9 w-full rounded-xl border border-line bg-paper px-3 text-xs"
                    />
                  </div>
                </div>
              )}

              {bulkActionOpen === "duration" && (
                <div className="space-y-3">
                  <label className="font-semibold text-ink">Изменить длительность</label>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {[-30, -15, 15, 30, 45, 60].map((min) => (
                      <button
                        key={min}
                        type="button"
                        onClick={() => setDurationChangeMinutes(min)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                          durationChangeMinutes === min
                            ? "bg-ink text-white"
                            : "bg-paper text-ink hover:bg-black/5"
                        }`}
                      >
                        {min > 0 ? `+${min} мин` : `${min} мин`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {bulkActionOpen === "category" && (
                <div className="space-y-3">
                  <label className="font-semibold text-ink">Название категории</label>
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Например, Окрашивание, Маникюр"
                    className="mt-1 h-9 w-full rounded-xl border border-line bg-paper px-3 text-xs"
                  />
                  {categories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-[11px] text-muted">Быстрый выбор:</span>
                      {categories.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewCategoryName(c)}
                          className="rounded bg-paper px-1.5 py-0.5 text-[10px] text-ink hover:bg-black/5"
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBulkActionOpen(null)}
                  className="btn btn-ghost h-9 text-xs"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleApplyBulk}
                  disabled={bulkPending}
                  className="btn btn-primary h-9 gap-1.5 px-4 text-xs font-semibold"
                >
                  {bulkPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  Применить ко всем ({selectedIds.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT / CREATE SERVICE MODAL */}
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
                  {editing === "new" ? "Новая услуга" : "Редактирование услуги"}
                </h2>
                <p className="mt-0.5 text-[12px] text-muted">
                  Клиент увидит услугу, длительность и цену при онлайн-записи.
                </p>
              </div>
              <button
                onClick={() => setEditing(null)}
                className="grid size-8 place-items-center rounded-full text-muted hover:bg-paper hover:text-ink"
                aria-label="Закрыть"
              >
                <X size={16} strokeWidth={1.6} />
              </button>
            </div>

            <ServiceForm
              service={editing === "new" ? null : editing}
              currency={currency}
              existingCategories={categories}
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
  existingCategories = [],
  onDone,
}: {
  service: ServiceRow | null;
  currency: string;
  existingCategories?: string[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    service ? updateServiceAction : createServiceAction,
    null,
  );
  const [duration, setDuration] = useState(service?.durationMin ?? 60);
  const [category, setCategory] = useState(service?.category ?? "");

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} className="space-y-4">
      {service && <input type="hidden" name="id" value={service.id} />}

      <div>
        <label className="label-base" htmlFor="name">
          Название услуги *
        </label>
        <input
          id="name"
          name="name"
          className="input-base"
          defaultValue={service?.name ?? ""}
          placeholder="Женская стрижка, Маникюр с покрытием"
          required
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-base" htmlFor="durationMin">
            Длительность *
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
            Цена *
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

      {/* Buffers before / after */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-base" htmlFor="bufferBeforeMin">
            Буфер до услуги (мин)
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
          <span className="text-[10px] text-muted">Подготовка места</span>
        </div>
        <div>
          <label className="label-base" htmlFor="bufferAfterMin">
            Буфер после (мин)
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
          <span className="text-[10px] text-muted">Уборка / проветривание</span>
        </div>
      </div>

      <div>
        <label className="label-base" htmlFor="category">
          Категория
        </label>
        <input
          id="category"
          name="category"
          className="input-base"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Волосы, Ногти, Брови, Уход..."
        />
        {existingCategories.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {existingCategories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className="rounded bg-paper px-1.5 py-0.5 text-[10px] text-ink-soft hover:bg-black/5"
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="label-base" htmlFor="description">
          Описание услуги
        </label>
        <textarea
          id="description"
          name="description"
          className="input-base h-18 resize-none py-2 text-xs"
          defaultValue={service?.description ?? ""}
          placeholder="Что входит в услугу, рекомендации клиенту..."
        />
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-[12.5px]">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={service?.isActive ?? true}
          className="size-4 rounded border-line accent-brand"
        />
        <span>Показывать на странице онлайн-записи</span>
      </label>

      {state?.error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12.5px] text-rose-700">
          {state.error}
        </div>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary w-full h-10 text-xs font-semibold">
        {pending ? <Loader2 size={15} className="animate-spin" /> : "Сохранить услугу"}
      </button>
    </form>
  );
}
