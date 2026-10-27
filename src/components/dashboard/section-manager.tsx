"use client";

import { useState } from "react";
import { useActionState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  Settings,
  ChevronDown,
  ChevronUp,
  LayoutDashboard,
  Users,
  Scissors,
  MapPin,
  Star,
  Tag,
  HelpCircle,
  ImageIcon,
  Briefcase,
  Code,
  MoveVertical,
} from "lucide-react";
import {
  createSectionAction,
  updateSectionAction,
  deleteSectionAction,
  reorderSectionsAction,
  getSections,
} from "@/server/actions/page-sections";

export type PageSection = {
  id: string;
  businessId: string;
  type: string;
  enabled: boolean;
  sortOrder: number;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

const SECTION_TYPES = [
  {
    type: "hero" as const,
    label: "Hero (шапка)",
    description: "Название, слоган, кнопка записи, ближайшее окно",
    icon: LayoutDashboard,
    defaultConfig: { showNearestSlot: true, ctaText: "Записаться онлайн" },
  },
  {
    type: "staff" as const,
    label: "Мастера",
    description: "Команда с фото, био и ближайшими слотами",
    icon: Users,
    defaultConfig: { title: "Мастера", subtitle: "Нажмите на мастера, чтобы увидеть свободное время", showBio: true, columns: 3 },
  },
  {
    type: "services" as const,
    label: "Услуги и цены",
    description: "Прайс с группировкой по категориям",
    icon: Scissors,
    defaultConfig: { title: "Услуги", subtitle: "Прайс", groupByCategory: true, showPrices: true, showDuration: true },
  },
  {
    type: "contacts" as const,
    label: "Контакты",
    description: "Адрес, телефон, Instagram, карта",
    icon: MapPin,
    defaultConfig: { title: "Контакты", showAddress: true, showPhone: true, showInstagram: true, showMap: false },
  },
  {
    type: "reviews" as const,
    label: "Отзывы",
    description: "Карточки отзывов с рейтингом",
    icon: Star,
    defaultConfig: { title: "Отзывы", subtitle: "Что говорят наши клиенты", items: [] },
  },
  {
    type: "promotions" as const,
    label: "Акции",
    description: "Специальные предложения со сроками действия",
    icon: Tag,
    defaultConfig: { title: "Акции", subtitle: "Специальные предложения", items: [] },
  },
  {
    type: "faq" as const,
    label: "Частые вопросы (FAQ)",
    description: "Аккордеон с вопросами и ответами",
    icon: HelpCircle,
    defaultConfig: { title: "Частые вопросы", items: [] },
  },
  {
    type: "gallery" as const,
    label: "Галерея работ",
    description: "До/после, фото работ мастеров",
    icon: ImageIcon,
    defaultConfig: { title: "Наши работы", subtitle: "До / После", items: [] },
  },
  {
    type: "vacancies" as const,
    label: "Вакансии",
    description: "Открытые позиции для мастеров",
    icon: Briefcase,
    defaultConfig: { title: "Вакансии", items: [] },
  },
  {
    type: "custom_html" as const,
    label: "Свой HTML/JS",
    description: "Пиксели, чат-виджеты, кастомный код",
    icon: Code,
    defaultConfig: { html: "" },
  },
] as const;

function SectionItem({
  section,
  index,
  onToggle,
  onEdit,
  onDelete,
}: {
  section: PageSection;
  index: number;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });

  const typeInfo = SECTION_TYPES.find((t) => t.type === section.type);
  const Icon = typeInfo?.icon ?? LayoutDashboard;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-[20px] border border-line/80 bg-white p-4 transition-all duration-300 ${isDragging ? "shadow-lift ring-2 ring-brand/30" : "hover:border-brand/30"}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 grid size-8 place-items-center rounded-lg bg-paper text-muted hover:text-ink hover:bg-white"
        aria-label="Перетащить"
      >
        <GripVertical size={16} strokeWidth={1.5} />
      </button>

      <div className="ml-8 flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
          <Icon size={17} strokeWidth={1.6} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[13.5px] font-semibold truncate">{typeInfo?.label ?? section.type}</p>
            <span className={`rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold ${section.enabled ? "bg-mint/10 text-mint" : "bg-paper text-muted"}`}>
              {section.enabled ? "Вкл" : "Выкл"}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[11.5px] text-muted">{typeInfo?.description ?? ""}</p>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onToggle}
            className="grid size-8 place-items-center rounded-lg text-muted hover:bg-paper hover:text-ink transition-colors"
            aria-label={section.enabled ? "Скрыть секцию" : "Показать секцию"}
          >
            {section.enabled ? <Eye size={16} strokeWidth={1.7} /> : <EyeOff size={16} strokeWidth={1.7} />}
          </button>
          <button
            onClick={onEdit}
            className="grid size-8 place-items-center rounded-lg text-muted hover:bg-paper hover:text-ink transition-colors"
            aria-label="Настроить"
          >
            <Settings size={16} strokeWidth={1.7} />
          </button>
          <button
            onClick={onDelete}
            className="grid size-8 place-items-center rounded-lg text-muted hover:bg-rose/5 hover:text-rose transition-colors"
            aria-label="Удалить"
          >
            <Trash2 size={16} strokeWidth={1.7} />
          </button>
        </div>
      </div>
    </div>
  );
}

function SortableSectionList({
  sections,
  onToggle,
  onEdit,
  onDelete,
  onReorder,
}: {
  sections: PageSection[];
  onToggle: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (sections: PageSection[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = sections.findIndex((s) => s.id === active.id);
      const newIndex = sections.findIndex((s) => s.id === over.id);
      const newSections = arrayMove(sections, oldIndex, newIndex);
      const reordered = newSections.map((s, i) => ({ ...s, sortOrder: i }));
      onReorder(reordered);
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {sections.map((section, index) => (
            <SectionItem
              key={section.id}
              section={section}
              index={index}
              onToggle={() => onToggle(section.id)}
              onEdit={() => onEdit(section.id)}
              onDelete={() => onDelete(section.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

type ItemField = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "date" | "select";
  options?: { value: string; label: string }[];
  placeholder?: string;
  wide?: boolean;
};

function ItemList({
  items,
  onChange,
  fields,
  blank,
  addLabel,
}: {
  items: Record<string, unknown>[];
  onChange: (items: Record<string, unknown>[]) => void;
  fields: ItemField[];
  blank: Record<string, unknown>;
  addLabel: string;
}) {
  function patch(index: number, key: string, value: unknown) {
    const next = key === "rating" ? Number(value) : value;
    onChange(items.map((item, i) => (i === index ? { ...item, [key]: next } : item)));
  }

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <p className="rounded-xl bg-paper px-3 py-2.5 text-[11.5px] text-muted">
          Пока пусто. Добавьте первый элемент — он сразу появится на странице.
        </p>
      )}

      {items.map((item, index) => (
        <div key={index} className="rounded-2xl border border-line/80 bg-paper/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10.5px] font-semibold tracking-[0.1em] text-muted uppercase">
              #{index + 1}
            </span>
            <button
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
              className="grid size-7 place-items-center rounded-lg text-muted hover:bg-rose/10 hover:text-rose"
              aria-label="Удалить"
            >
              <Trash2 size={13} strokeWidth={1.8} />
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {fields.map((field) => (
              <label
                key={field.key}
                className={`block ${field.wide || field.type === "textarea" ? "sm:col-span-2" : ""}`}
              >
                <span className="mb-1 block text-[10.5px] font-medium text-muted">
                  {field.label}
                </span>
                {field.type === "textarea" ? (
                  <textarea
                    rows={3}
                    value={String(item[field.key] ?? "")}
                    placeholder={field.placeholder}
                    onChange={(event) => patch(index, field.key, event.target.value)}
                    className="input-base h-auto resize-y text-[12px]"
                  />
                ) : field.type === "select" ? (
                  <select
                    value={String(item[field.key] ?? "")}
                    onChange={(event) => patch(index, field.key, event.target.value)}
                    className="input-base h-9 text-[12px]"
                  >
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type === "date" ? "date" : "text"}
                    value={String(item[field.key] ?? "")}
                    placeholder={field.placeholder}
                    onChange={(event) => patch(index, field.key, event.target.value)}
                    className="input-base h-9 text-[12px]"
                  />
                )}
              </label>
            ))}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...items, { ...blank }])}
        className="btn btn-ghost h-9 w-full text-[11.5px]"
      >
        <Plus size={13} /> {addLabel}
      </button>
    </div>
  );
}

function configItems(config: Record<string, unknown>) {
  return Array.isArray(config.items) ? (config.items as Record<string, unknown>[]) : [];
}

function SectionConfigModal({
  section,
  onClose,
  onSave,
}: {
  section: PageSection | null;
  onClose: () => void;
  onSave: (config: Record<string, unknown>) => void;
}) {
  const [config, setConfig] = useState<Record<string, unknown>>(() => ({
    ...(section?.config ?? {}),
  }));

  if (!section) return null;

  const typeInfo = SECTION_TYPES.find((t) => t.type === section.type);
  const items = configItems(config);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-lift sm:rounded-[28px] sm:p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[18px] font-semibold">Настройки секции</h2>
            <p className="mt-0.5 text-[12px] text-muted">{typeInfo?.label}</p>
          </div>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg bg-paper text-muted hover:text-ink" aria-label="Закрыть">
            <ChevronUp size={16} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(config);
          }}
          className="mt-5 space-y-4"
        >
          {typeInfo?.type === "hero" && (
            <>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(config.showNearestSlot ?? true)}
                  onChange={(e) => setConfig({ ...config, showNearestSlot: e.target.checked })}
                  className="size-4 accent-brand"
                />
                <span className="text-[13px]">Показывать ближайшее свободное окно</span>
              </label>
              <div>
                <label className="label-base">Текст кнопки</label>
                <input
                  type="text"
                  value={String(config.ctaText ?? "Записаться онлайн")}
                  onChange={(e) => setConfig({ ...config, ctaText: e.target.value })}
                  className="input-base"
                />
              </div>
            </>
          )}

          {typeInfo?.type === "staff" && (
            <>
              <div>
                <label className="label-base">Заголовок</label>
                <input
                  type="text"
                  value={String(config.title ?? "Мастера")}
                  onChange={(e) => setConfig({ ...config, title: e.target.value })}
                  className="input-base"
                />
              </div>
              <div>
                <label className="label-base">Подзаголовок</label>
                <input
                  type="text"
                  value={String(config.subtitle ?? "")}
                  onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
                  className="input-base"
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(config.showBio ?? true)}
                  onChange={(e) => setConfig({ ...config, showBio: e.target.checked })}
                  className="size-4 accent-brand"
                />
                <span className="text-[13px]">Показывать био мастера</span>
              </label>
              <div>
                <label className="label-base">Колонок (1–3)</label>
                <select
                  value={Number(config.columns ?? 3)}
                  onChange={(e) => setConfig({ ...config, columns: Number(e.target.value) })}
                  className="input-base"
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </div>
            </>
          )}

          {typeInfo?.type === "services" && (
            <>
              <div>
                <label className="label-base">Заголовок</label>
                <input
                  type="text"
                  value={String(config.title ?? "Услуги")}
                  onChange={(e) => setConfig({ ...config, title: e.target.value })}
                  className="input-base"
                />
              </div>
              <div>
                <label className="label-base">Подзаголовок</label>
                <input
                  type="text"
                  value={String(config.subtitle ?? "Прайс")}
                  onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
                  className="input-base"
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(config.groupByCategory ?? true)}
                  onChange={(e) => setConfig({ ...config, groupByCategory: e.target.checked })}
                  className="size-4 accent-brand"
                />
                <span className="text-[13px]">Группировать по категориям</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(config.showPrices ?? true)}
                  onChange={(e) => setConfig({ ...config, showPrices: e.target.checked })}
                  className="size-4 accent-brand"
                />
                <span className="text-[13px]">Показывать цены</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(config.showDuration ?? true)}
                  onChange={(e) => setConfig({ ...config, showDuration: e.target.checked })}
                  className="size-4 accent-brand"
                />
                <span className="text-[13px]">Показывать длительность</span>
              </label>
            </>
          )}

          {typeInfo?.type === "contacts" && (
            <>
              <div>
                <label className="label-base">Заголовок</label>
                <input
                  type="text"
                  value={String(config.title ?? "Контакты")}
                  onChange={(e) => setConfig({ ...config, title: e.target.value })}
                  className="input-base"
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(config.showAddress ?? true)}
                  onChange={(e) => setConfig({ ...config, showAddress: e.target.checked })}
                  className="size-4 accent-brand"
                />
                <span className="text-[13px]">Адрес</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(config.showPhone ?? true)}
                  onChange={(e) => setConfig({ ...config, showPhone: e.target.checked })}
                  className="size-4 accent-brand"
                />
                <span className="text-[13px]">Телефон</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(config.showInstagram ?? true)}
                  onChange={(e) => setConfig({ ...config, showInstagram: e.target.checked })}
                  className="size-4 accent-brand"
                />
                <span className="text-[13px]">Instagram</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(config.showMap ?? false)}
                  onChange={(e) => setConfig({ ...config, showMap: e.target.checked })}
                  className="size-4 accent-brand"
                />
                <span className="text-[13px]">Показывать карту (iframe)</span>
              </label>
            </>
          )}

          {typeInfo?.type === "reviews" && (
            <>
              <div>
                <label className="label-base">Заголовок</label>
                <input
                  type="text"
                  value={String(config.title ?? "Отзывы")}
                  onChange={(e) => setConfig({ ...config, title: e.target.value })}
                  className="input-base"
                />
              </div>
              <div>
                <label className="label-base">Подзаголовок</label>
                <input
                  type="text"
                  value={String(config.subtitle ?? "Что говорят наши клиенты")}
                  onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
                  className="input-base"
                />
              </div>
              <p className="mt-1 text-[11.5px] text-muted">
                Добавляйте реальные отзывы клиентов — они повышают доверие и конверсию записи.
              </p>
              <ItemList
                items={items}
                onChange={(next) => setConfig({ ...config, items: next })}
                fields={[
                  { key: "name", label: "Имя клиента", placeholder: "Дилноза" },
                  {
                    key: "rating",
                    label: "Оценка",
                    type: "select",
                    options: [
                      { value: "5", label: "★★★★★ — отлично" },
                      { value: "4", label: "★★★★ — хорошо" },
                      { value: "3", label: "★★★ — нормально" },
                      { value: "2", label: "★★ — плохо" },
                      { value: "1", label: "★ — ужасно" },
                    ],
                  },
                  { key: "date", label: "Дата", type: "date" },
                  { key: "text", label: "Текст отзыва", type: "textarea", placeholder: "Что понравилось?" },
                ]}
                blank={{ name: "", rating: 5, date: new Date().toISOString().slice(0, 10), text: "" }}
                addLabel="Добавить отзыв"
              />
            </>
          )}

          {typeInfo?.type === "promotions" && (
            <>
              <div>
                <label className="label-base">Заголовок</label>
                <input
                  type="text"
                  value={String(config.title ?? "Акции")}
                  onChange={(e) => setConfig({ ...config, title: e.target.value })}
                  className="input-base"
                />
              </div>
              <div>
                <label className="label-base">Подзаголовок</label>
                <input
                  type="text"
                  value={String(config.subtitle ?? "Специальные предложения")}
                  onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
                  className="input-base"
                />
              </div>
              <ItemList
                items={items}
                onChange={(next) => setConfig({ ...config, items: next })}
                fields={[
                  { key: "title", label: "Название акции", placeholder: "Первая стрижка −20%" },
                  { key: "serviceCategory", label: "Категория услуг", placeholder: "Волосы" },
                  { key: "validUntil", label: "Действует до", type: "date" },
                  { key: "description", label: "Описание", type: "textarea", placeholder: "Условия акции" },
                ]}
                blank={{ title: "", serviceCategory: "", validUntil: "", description: "" }}
                addLabel="Добавить акцию"
              />
            </>
          )}

          {typeInfo?.type === "faq" && (
            <>
              <div>
                <label className="label-base">Заголовок</label>
                <input
                  type="text"
                  value={String(config.title ?? "Частые вопросы")}
                  onChange={(e) => setConfig({ ...config, title: e.target.value })}
                  className="input-base"
                />
              </div>
              <ItemList
                items={items}
                onChange={(next) => setConfig({ ...config, items: next })}
                fields={[
                  { key: "question", label: "Вопрос", placeholder: "Как отменить запись?" },
                  { key: "answer", label: "Ответ", type: "textarea", placeholder: "Коротко и понятно" },
                ]}
                blank={{ question: "", answer: "" }}
                addLabel="Добавить вопрос"
              />
            </>
          )}

          {typeInfo?.type === "gallery" && (
            <>
              <div>
                <label className="label-base">Заголовок</label>
                <input
                  type="text"
                  value={String(config.title ?? "Наши работы")}
                  onChange={(e) => setConfig({ ...config, title: e.target.value })}
                  className="input-base"
                />
              </div>
              <div>
                <label className="label-base">Подзаголовок</label>
                <input
                  type="text"
                  value={String(config.subtitle ?? "До / После")}
                  onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
                  className="input-base"
                />
              </div>
              <p className="rounded-xl bg-brand-soft/50 px-3 py-2.5 text-[11.5px] leading-relaxed text-brand-dark">
                Фотографии добавляются во вкладке «Галерея». Здесь можно изменить только
                заголовок блока.
              </p>
            </>
          )}

          {typeInfo?.type === "vacancies" && (
            <>
              <div>
                <label className="label-base">Заголовок</label>
                <input
                  type="text"
                  value={String(config.title ?? "Вакансии")}
                  onChange={(e) => setConfig({ ...config, title: e.target.value })}
                  className="input-base"
                />
              </div>
              <ItemList
                items={items}
                onChange={(next) => setConfig({ ...config, items: next })}
                fields={[
                  { key: "title", label: "Должность", placeholder: "Колорист" },
                  { key: "requirements", label: "Требования", placeholder: "Опыт от 2 лет" },
                  { key: "description", label: "Описание", type: "textarea", placeholder: "Условия и обязанности" },
                ]}
                blank={{ title: "", requirements: "", description: "" }}
                addLabel="Добавить вакансию"
              />
            </>
          )}

          {typeInfo?.type === "custom_html" && (
            <>
              <div>
                <label className="label-base">HTML / JavaScript код</label>
                <textarea
                  value={String(config.html ?? "")}
                  onChange={(e) => setConfig({ ...config, html: e.target.value })}
                  rows={8}
                  className="input-base h-auto resize-y font-mono text-[12px]"
                  placeholder="<script>...</script>"
                />
              </div>
              <p className="text-[11.5px] text-rose">Будьте осторожны: некорректный код может сломать страницу.</p>
            </>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-ghost h-11 flex-1 text-[12.5px]">
              Отмена
            </button>
            <button type="submit" className="btn btn-primary h-11 flex-[1.4] text-[12.5px]">
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function SectionManager({
  initialSections,
}: {
  initialSections: PageSection[];
}) {
  const [sections, setSections] = useState<PageSection[]>(initialSections);
  const [editingSection, setEditingSection] = useState<PageSection | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const [, createAction] = useActionState(createSectionAction, null);
  const [, updateAction] = useActionState(updateSectionAction, null);
  const [, deleteAction] = useActionState(deleteSectionAction, null);
  const [, reorderAction] = useActionState(reorderSectionsAction, null);

  async function handleToggle(id: string) {
    const section = sections.find((s) => s.id === id);
    if (!section) return;
    const formData = new FormData();
    formData.append("sectionId", id);
    formData.append("type", section.type);
    formData.append("enabled", String(!section.enabled));
    formData.append("sortOrder", String(section.sortOrder));
    formData.append("config", JSON.stringify(section.config));
    await updateAction(formData);
    setSections(sections.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));
  }

  async function handleEdit(id: string) {
    const section = sections.find((s) => s.id === id);
    if (section) setEditingSection(section);
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить эту секцию? Она исчезнет со страницы.")) return;
    const formData = new FormData();
    formData.append("sectionId", id);
    await deleteAction(formData);
    setSections(sections.filter((s) => s.id !== id));
  }

  async function handleReorder(newSections: PageSection[]) {
    const order = newSections.map((s, i) => ({ id: s.id, sortOrder: i }));
    const formData = new FormData();
    formData.append("order", JSON.stringify(order));
    await reorderAction(formData);
    setSections(newSections);
  }

  async function handleConfigSave(config: Record<string, unknown>) {
    if (!editingSection) return;
    const formData = new FormData();
    formData.append("sectionId", editingSection.id);
    formData.append("type", editingSection.type);
    formData.append("enabled", String(editingSection.enabled));
    formData.append("sortOrder", String(editingSection.sortOrder));
    formData.append("config", JSON.stringify(config));
    await updateAction(formData);
    setSections(sections.map((s) => (s.id === editingSection.id ? { ...s, config } : s)));
    setEditingSection(null);
  }

  async function handleAddSection(type: string) {
    const typeInfo = SECTION_TYPES.find((t) => t.type === type);
    if (!typeInfo) return;

    const maxOrder = Math.max(...sections.map((s) => s.sortOrder), -1);
    const formData = new FormData();
    formData.append("type", type);
    formData.append("enabled", "true");
    formData.append("sortOrder", String(maxOrder + 1));
    formData.append("config", JSON.stringify(typeInfo.defaultConfig));

    const result = await createSectionAction(null, formData);
    if (result?.ok && result.sectionId) {
      const newSection: PageSection = {
        id: result.sectionId,
        businessId: "",
        type,
        enabled: true,
        sortOrder: maxOrder + 1,
        config: typeInfo.defaultConfig,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setSections([...sections, newSection].sort((a, b) => a.sortOrder - b.sortOrder));
    }
    setShowAddModal(false);
  }

  const existingTypes = new Set(sections.map((s) => s.type));
  const availableTypes = SECTION_TYPES.filter((t) => !existingTypes.has(t.type));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-muted">
          Блоков: <b className="text-ink">{sections.length}</b> · включено{" "}
          <b className="text-ink">{sections.filter((section) => section.enabled).length}</b>
        </p>
        <button onClick={() => setShowAddModal(true)} className="btn btn-primary h-10 text-[12.5px]">
          <Plus size={15} strokeWidth={1.8} /> Добавить блок
        </button>
      </div>

      {sections.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-line bg-white/60 px-6 py-14 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
            <LayoutDashboard size={20} strokeWidth={1.5} />
          </span>
          <p className="mt-4 text-[15px] font-semibold">Секций пока нет</p>
          <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-muted">
            Добавьте первую секцию — Hero (шапка), Мастера, Услуги или другую.
          </p>
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary mt-5 h-10 text-[12.5px]">
            <Plus size={15} /> Добавить секцию
          </button>
        </div>
      ) : (
        <SortableSectionList
          sections={sections}
          onToggle={handleToggle}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onReorder={handleReorder}
        />
      )}

      {editingSection && (
        <SectionConfigModal
          key={editingSection.id}
          section={editingSection}
          onClose={() => setEditingSection(null)}
          onSave={handleConfigSave}
        />
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <div className="w-full max-w-md rounded-t-[28px] bg-white p-5 shadow-lift sm:rounded-[28px] sm:p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-[18px] font-semibold">Добавить секцию</h2>
                <p className="mt-0.5 text-[12px] text-muted">Выберите тип блока для вашей страницы</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="grid size-8 place-items-center rounded-lg bg-paper text-muted hover:text-ink" aria-label="Закрыть">
                <ChevronDown size={16} />
              </button>
            </div>

            <div className="mt-5 grid gap-2 max-h-[50vh] overflow-y-auto">
              {availableTypes.map((typeInfo) => (
                <button
                  key={typeInfo.type}
                  type="button"
                  onClick={() => handleAddSection(typeInfo.type)}
                  className="flex items-center gap-3 rounded-xl border border-line p-3.5 text-left transition-all duration-300 hover:border-brand/30 hover:bg-brand-soft/30"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                    <typeInfo.icon size={18} strokeWidth={1.6} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold">{typeInfo.label}</p>
                    <p className="mt-0.5 truncate text-[11.5px] text-muted">{typeInfo.description}</p>
                  </div>
                  <MoveVertical size={16} strokeWidth={1.7} className="text-muted/50" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}