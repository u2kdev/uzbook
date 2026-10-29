"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
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
  Settings2,
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
  ArrowUp,
  ArrowDown,
  Sparkles,
  Check,
  Smartphone,
  Wand2,
  Zap,
  Camera,
  Layers,
} from "lucide-react";
import {
  createSectionAction,
  updateSectionAction,
  deleteSectionAction,
  reorderSectionsAction,
  applyPagePresetAction,
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

export const SECTION_TYPES = [
  {
    type: "hero" as const,
    label: "Шапка (Hero)",
    shortLabel: "Шапка",
    description: "Обложка, название, кнопка записи и ближайшее окно",
    icon: LayoutDashboard,
    defaultConfig: {
      showNearestSlot: true,
      showPhoneButton: true,
      ctaText: "Записаться онлайн",
      badgeText: "",
      align: "left",
    },
  },
  {
    type: "services" as const,
    label: "Услуги и цены",
    shortLabel: "Услуги",
    description: "Прайс-лист с категориями, ценами и длительностью",
    icon: Scissors,
    defaultConfig: {
      title: "Услуги и цены",
      subtitle: "Прайс",
      groupByCategory: true,
      showPrices: true,
      showDuration: true,
    },
  },
  {
    type: "staff" as const,
    label: "Команда мастеров",
    shortLabel: "Мастера",
    description: "Карточки специалистов с фото, опытом и свободным временем",
    icon: Users,
    defaultConfig: {
      title: "Мастера",
      subtitle: "Команда",
      showBio: true,
      showNextSlots: true,
      columns: 3,
    },
  },
  {
    type: "gallery" as const,
    label: "Галерея работ",
    shortLabel: "Галерея",
    description: "Фотографии работ и результаты До / После",
    icon: ImageIcon,
    defaultConfig: { title: "Наши работы", subtitle: "До / После", items: [] },
  },
  {
    type: "promotions" as const,
    label: "Акции и скидки",
    shortLabel: "Акции",
    description: "Спецпредложения и бонусы для новых или постоянных гостей",
    icon: Tag,
    defaultConfig: { title: "Акции", subtitle: "Специальные предложения", items: [] },
  },
  {
    type: "reviews" as const,
    label: "Отзывы клиентов",
    shortLabel: "Отзывы",
    description: "Реальные отзывы гостей с оценками 1–5 звёзд",
    icon: Star,
    defaultConfig: { title: "Отзывы", subtitle: "Что говорят наши клиенты", items: [] },
  },
  {
    type: "faq" as const,
    label: "Частые вопросы (FAQ)",
    shortLabel: "Вопросы",
    description: "Ответы на популярные вопросы клиентов перед записью",
    icon: HelpCircle,
    defaultConfig: { title: "Частые вопросы", items: [] },
  },
  {
    type: "contacts" as const,
    label: "Контакты и адрес",
    shortLabel: "Контакты",
    description: "Адрес, телефон для связи, ссылка на Instagram и сайт",
    icon: MapPin,
    defaultConfig: {
      title: "Контакты",
      showAddress: true,
      showPhone: true,
      showInstagram: true,
      showWebsite: true,
    },
  },
  {
    type: "vacancies" as const,
    label: "Вакансии",
    shortLabel: "Вакансии",
    description: "Открытые позиции, если вы ищете мастеров в команду",
    icon: Briefcase,
    defaultConfig: { title: "Вакансии", items: [] },
  },
  {
    type: "custom_html" as const,
    label: "Свой текстовый / HTML-блок",
    shortLabel: "Свой блок",
    description: "Произвольный текст, правила посещения или блок «О нас»",
    icon: Code,
    defaultConfig: { html: "" },
  },
] as const;

const PAGE_PRESETS = [
  {
    id: "salon_standard",
    title: "Стандарт салона",
    subtitle: "Оптимально для большинства",
    description: "Шапка → Услуги → Мастера → Галерея → Отзывы → Контакты",
    icon: Sparkles,
    badge: "Рекомендуем",
  },
  {
    id: "quick_booking",
    title: "Быстрая запись",
    subtitle: "Ничего лишнего",
    description: "Шапка → Услуги → Мастера → Контакты",
    icon: Zap,
    badge: "Минимализм",
  },
  {
    id: "portfolio_focus",
    title: "Акцент на портфолио",
    subtitle: "Для beauty-мастеров",
    description: "Шапка → Галерея → Услуги → Мастера → Акции → Отзывы → Контакты",
    icon: Camera,
    badge: "Визуал",
  },
  {
    id: "full_landing",
    title: "Полный лендинг",
    subtitle: "Максимум информации",
    description: "Все продающие блоки: Шапка, Акции, Услуги, Мастера, Галерея, Отзывы, FAQ, Контакты",
    icon: Layers,
    badge: "Максимум",
  },
] as const;

const FAQ_TEMPLATES = [
  {
    label: "+ Как перенести или отменить запись?",
    item: {
      question: "Как перенести или отменить запись?",
      answer: "Вы можете отменить или перенести визит по ссылке из подтверждения записи или позвонив нам минимум за 3 часа до визита.",
    },
  },
  {
    label: "+ Какие способы оплаты вы принимаете?",
    item: {
      question: "Какие способы оплаты вы принимаете?",
      answer: "Мы принимаем наличные, переводы на карту (Payme, Click, Uzcard, Humo) и оплату через терминал.",
    },
  },
  {
    label: "+ Есть ли парковка рядом с салоном?",
    item: {
      question: "Есть ли парковка рядом с салоном?",
      answer: "Да, рядом со входом есть удобная бесплатная парковка для наших гостей.",
    },
  },
  {
    label: "+ Даёте ли вы гарантию на услуги?",
    item: {
      question: "Даёте ли вы гарантию на услуги?",
      answer: "Мы работаем только на проверенных материалах и даём гарантию качества на все виды процедур.",
    },
  },
];

const PROMO_TEMPLATES = [
  {
    label: "+ Скидка −15% на первый визит",
    item: {
      title: "Знакомство с мастером −15%",
      serviceCategory: "Для новых гостей",
      validUntil: "",
      description: "Скидка 15% на любую услугу при первой онлайн-записи через сайт.",
    },
  },
  {
    label: "+ Комплекс со скидкой",
    item: {
      title: "Комплексный уход по спеццене",
      serviceCategory: "Комплекс",
      validUntil: "",
      description: "Запишитесь на две процедуры в один день и получите приятную скидку 20%.",
    },
  },
  {
    label: "+ Подарок именинникам",
    item: {
      title: "Скидка 20% в День рождения",
      serviceCategory: "Праздничная акция",
      validUntil: "",
      description: "Действует за 3 дня до и 3 дня после вашего Дня рождения.",
    },
  },
];

const REVIEW_TEMPLATES = [
  {
    label: "+ Пример отзыва (5★)",
    item: {
      name: "Мадина К.",
      rating: 5,
      date: new Date().toISOString().slice(0, 10),
      text: "Очень уютный салон и внимательные мастера! Записалась онлайн за минуту, приняли ровно ко времени. Результатом в полном восторге!",
    },
  },
  {
    label: "+ Отзыв о сервисе (5★)",
    item: {
      name: "Азиза Т.",
      rating: 5,
      date: new Date().toISOString().slice(0, 10),
      text: "Хожу сюда уже полгода. Всегда стерильно, вкусный кофе и идеальный результат. Рекомендую!",
    },
  },
];

const VACANCY_TEMPLATES = [
  {
    label: "+ Мастер маникюра / стилист",
    item: {
      title: "Топ-мастер / стилист",
      requirements: "Опыт работы от 1 года, аккуратность, любовь к клиентам",
      description: "Гибкий график, высокий процент, полная запись и комфортное оборудованное место.",
    },
  },
];

function configItems(config: Record<string, unknown>) {
  return Array.isArray(config.items) ? (config.items as Record<string, unknown>[]) : [];
}

/**
 * Large button-based toggle pill for mobile & desktop
 */
function OptionToggleButton({
  active,
  label,
  description,
  onClick,
}: {
  active: boolean;
  label: string;
  description?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition-all active:scale-[0.99] ${
        active
          ? "border-brand/40 bg-brand-soft/40 text-ink shadow-xs"
          : "border-line bg-white text-muted hover:border-line/90 hover:bg-paper/60"
      }`}
    >
      <div className="min-w-0">
        <p className={`text-[13px] font-semibold ${active ? "text-ink" : "text-ink/80"}`}>
          {label}
        </p>
        {description && <p className="mt-0.5 text-[11px] text-muted">{description}</p>}
      </div>
      <span
        className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold transition-colors ${
          active ? "bg-brand text-white" : "bg-paper text-muted"
        }`}
      >
        {active ? (
          <>
            <Check size={12} strokeWidth={2.5} /> Вкл
          </>
        ) : (
          "Выкл"
        )}
      </span>
    </button>
  );
}

/**
 * Quick-pick chips for common text fields so mobile users don't have to type
 */
function QuickTextChips({
  options,
  currentValue,
  onSelect,
}: {
  options: string[];
  currentValue: string;
  onSelect: (val: string) => void;
}) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {options.map((option) => {
        const active = currentValue.trim() === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onSelect(option)}
            className={`rounded-lg border px-2.5 py-1 text-[11.5px] font-medium transition-all active:scale-95 ${
              active
                ? "border-brand bg-brand text-white"
                : "border-line bg-paper/70 text-ink/80 hover:border-brand/40 hover:bg-white"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

type ItemField = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "date" | "rating";
  placeholder?: string;
  wide?: boolean;
};

function ItemList({
  items,
  onChange,
  fields,
  blank,
  addLabel,
  templates,
}: {
  items: Record<string, unknown>[];
  onChange: (items: Record<string, unknown>[]) => void;
  fields: ItemField[];
  blank: Record<string, unknown>;
  addLabel: string;
  templates?: { label: string; item: Record<string, unknown> }[];
}) {
  function patch(index: number, key: string, value: unknown) {
    const next = key === "rating" ? Number(value) : value;
    onChange(items.map((item, i) => (i === index ? { ...item, [key]: next } : item)));
  }

  function moveItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const copy = [...items];
    const [removed] = copy.splice(index, 1);
    copy.splice(target, 0, removed);
    onChange(copy);
  }

  return (
    <div className="space-y-3">
      {templates && templates.length > 0 && (
        <div className="rounded-2xl border border-dashed border-brand/30 bg-brand-soft/20 p-3">
          <p className="mb-2 text-[11px] font-semibold text-brand-dark">
            ⚡ Быстрое добавление готового шаблона в 1 нажатие:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {templates.map((tpl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onChange([...items, { ...tpl.item }])}
                className="rounded-xl border border-brand/30 bg-white px-3 py-1.5 text-[11.5px] font-medium text-ink shadow-2xs transition-all hover:border-brand hover:bg-brand-soft/40 active:scale-95"
              >
                {tpl.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 && (
        <p className="rounded-xl bg-paper px-3.5 py-3 text-[12px] text-muted">
          Список пока пуст. Нажмите на готовый шаблон выше или кнопку «{addLabel}» ниже.
        </p>
      )}

      {items.map((item, index) => (
        <div key={index} className="rounded-2xl border border-line bg-white p-3.5 shadow-2xs">
          <div className="mb-2.5 flex items-center justify-between border-b border-line/60 pb-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted uppercase">
              Элемент #{index + 1}
            </span>
            <div className="flex items-center gap-1">
              {items.length > 1 && (
                <>
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveItem(index, -1)}
                    className="grid size-7 place-items-center rounded-lg border border-line bg-paper text-ink disabled:opacity-30"
                    title="Выше"
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    disabled={index === items.length - 1}
                    onClick={() => moveItem(index, 1)}
                    className="grid size-7 place-items-center rounded-lg border border-line bg-paper text-ink disabled:opacity-30"
                    title="Ниже"
                  >
                    <ArrowDown size={13} />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => onChange(items.filter((_, i) => i !== index))}
                className="inline-flex h-7 items-center gap-1 rounded-lg border border-rose/20 bg-rose/5 px-2 text-[11px] font-medium text-rose hover:bg-rose/10"
              >
                <Trash2 size={12} /> Удалить
              </button>
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            {fields.map((field) => (
              <div
                key={field.key}
                className={field.wide || field.type === "textarea" ? "sm:col-span-2" : ""}
              >
                <span className="mb-1 block text-[11px] font-medium text-muted">
                  {field.label}
                </span>
                {field.type === "textarea" ? (
                  <textarea
                    rows={2}
                    value={String(item[field.key] ?? "")}
                    placeholder={field.placeholder}
                    onChange={(event) => patch(index, field.key, event.target.value)}
                    className="input-base h-auto resize-y py-2 text-[12.5px]"
                  />
                ) : field.type === "rating" ? (
                  <div className="flex items-center gap-1">
                    {[5, 4, 3, 2, 1].map((stars) => {
                      const active = Number(item[field.key] ?? 5) === stars;
                      return (
                        <button
                          key={stars}
                          type="button"
                          onClick={() => patch(index, field.key, stars)}
                          className={`flex-1 rounded-xl border py-2 text-[12px] font-semibold transition-all ${
                            active
                              ? "border-brand bg-brand text-white"
                              : "border-line bg-paper text-ink hover:bg-white"
                          }`}
                        >
                          {stars} ★
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <input
                    type={field.type === "date" ? "date" : "text"}
                    value={String(item[field.key] ?? "")}
                    placeholder={field.placeholder}
                    onChange={(event) => patch(index, field.key, event.target.value)}
                    className="input-base h-9 text-[12.5px]"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...items, { ...blank }])}
        className="btn btn-secondary h-10 w-full gap-1.5 text-[12.5px]"
      >
        <Plus size={15} /> {addLabel}
      </button>
    </div>
  );
}

/**
 * Inline button-friendly editor rendered directly inside the expanded section card
 */
function InlineSectionEditor({
  section,
  onSave,
  onCancel,
  onOpenGallery,
  isSaving,
}: {
  section: PageSection;
  onSave: (config: Record<string, unknown>) => void;
  onCancel: () => void;
  onOpenGallery?: () => void;
  isSaving: boolean;
}) {
  const [config, setConfig] = useState<Record<string, unknown>>(() => ({
    ...(section.config ?? {}),
  }));

  const items = configItems(config);

  return (
    <div className="mt-4 space-y-4 border-t border-line pt-4">
      {section.type === "hero" && (
        <>
          <div>
            <label className="label-base">Текст главной кнопки записи</label>
            <input
              type="text"
              value={String(config.ctaText ?? "Записаться онлайн")}
              onChange={(e) => setConfig({ ...config, ctaText: e.target.value })}
              className="input-base"
              placeholder="Записаться онлайн"
            />
            <QuickTextChips
              options={[
                "Записаться онлайн",
                "Выбрать время",
                "Забронировать визит",
                "Записаться к мастеру",
              ]}
              currentValue={String(config.ctaText ?? "Записаться онлайн")}
              onSelect={(val) => setConfig({ ...config, ctaText: val })}
            />
          </div>

          <div>
            <label className="label-base">Плашка над заголовком (необязательно)</label>
            <input
              type="text"
              value={String(config.badgeText ?? "")}
              onChange={(e) => setConfig({ ...config, badgeText: e.target.value })}
              className="input-base"
              placeholder="По умолчанию: категория салона и город"
            />
            <QuickTextChips
              options={[
                "",
                "Онлайн-запись 24/7",
                "Премиум сервис",
                "Скидка 15% новым гостям",
              ]}
              currentValue={String(config.badgeText ?? "")}
              onSelect={(val) => setConfig({ ...config, badgeText: val })}
            />
          </div>

          <div>
            <label className="label-base">Выравнивание шапки</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "left", label: "Слева (классика)" },
                { id: "center", label: "По центру" },
              ].map((opt) => {
                const active = (config.align ?? "left") === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setConfig({ ...config, align: opt.id })}
                    className={`rounded-xl border py-2.5 text-[12.5px] font-semibold transition-all ${
                      active
                        ? "border-brand bg-brand text-white shadow-xs"
                        : "border-line bg-white text-ink hover:bg-paper"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <OptionToggleButton
              active={Boolean(config.showNearestSlot ?? true)}
              label="Ближайшее свободное окно"
              description="Показывает плашку со свободным временем"
              onClick={() =>
                setConfig({ ...config, showNearestSlot: !(config.showNearestSlot ?? true) })
              }
            />
            <OptionToggleButton
              active={Boolean(config.showPhoneButton ?? true)}
              label="Кнопка «Позвонить»"
              description="Быстрый звонок рядом с кнопкой записи"
              onClick={() =>
                setConfig({ ...config, showPhoneButton: !(config.showPhoneButton ?? true) })
              }
            />
          </div>
        </>
      )}

      {section.type === "services" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label-base">Заголовок раздела</label>
              <input
                type="text"
                value={String(config.title ?? "Услуги и цены")}
                onChange={(e) => setConfig({ ...config, title: e.target.value })}
                className="input-base"
              />
              <QuickTextChips
                options={["Услуги и цены", "Прайс-лист", "Каталог услуг", "Наши процедуры"]}
                currentValue={String(config.title ?? "Услуги и цены")}
                onSelect={(val) => setConfig({ ...config, title: val })}
              />
            </div>
            <div>
              <label className="label-base">Надпись над заголовком</label>
              <input
                type="text"
                value={String(config.subtitle ?? "Прайс")}
                onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
                className="input-base"
              />
              <QuickTextChips
                options={["Прайс", "Меню услуг", "Выберите процедуру"]}
                currentValue={String(config.subtitle ?? "Прайс")}
                onSelect={(val) => setConfig({ ...config, subtitle: val })}
              />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <OptionToggleButton
              active={Boolean(config.groupByCategory ?? true)}
              label="По категориям"
              description="Группировать прайс по разделам"
              onClick={() =>
                setConfig({ ...config, groupByCategory: !(config.groupByCategory ?? true) })
              }
            />
            <OptionToggleButton
              active={Boolean(config.showPrices ?? true)}
              label="Показывать цены"
              description="Стоимость каждой услуги"
              onClick={() =>
                setConfig({ ...config, showPrices: !(config.showPrices ?? true) })
              }
            />
            <OptionToggleButton
              active={Boolean(config.showDuration ?? true)}
              label="Длительность"
              description="Время процедуры в минутах"
              onClick={() =>
                setConfig({ ...config, showDuration: !(config.showDuration ?? true) })
              }
            />
          </div>
        </>
      )}

      {section.type === "staff" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label-base">Заголовок раздела</label>
              <input
                type="text"
                value={String(config.title ?? "Мастера")}
                onChange={(e) => setConfig({ ...config, title: e.target.value })}
                className="input-base"
              />
              <QuickTextChips
                options={["Мастера", "Наша команда", "Специалисты", "Топ-стилисты"]}
                currentValue={String(config.title ?? "Мастера")}
                onSelect={(val) => setConfig({ ...config, title: val })}
              />
            </div>
            <div>
              <label className="label-base">Надпись над заголовком</label>
              <input
                type="text"
                value={String(config.subtitle ?? "Команда")}
                onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
                className="input-base"
              />
              <QuickTextChips
                options={["Команда", "Выберите специалиста", "Профессионалы"]}
                currentValue={String(config.subtitle ?? "Команда")}
                onSelect={(val) => setConfig({ ...config, subtitle: val })}
              />
            </div>
          </div>

          <div>
            <label className="label-base">Размер карточек мастеров (на ПК / планшете)</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { cols: 1, label: "1 в ряд (крупно)" },
                { cols: 2, label: "2 в ряд (средне)" },
                { cols: 3, label: "3 в ряд (компактно)" },
              ].map((opt) => {
                const active = Number(config.columns ?? 3) === opt.cols;
                return (
                  <button
                    key={opt.cols}
                    type="button"
                    onClick={() => setConfig({ ...config, columns: opt.cols })}
                    className={`rounded-xl border py-2.5 px-2 text-[12px] font-semibold transition-all ${
                      active
                        ? "border-brand bg-brand text-white shadow-xs"
                        : "border-line bg-white text-ink hover:bg-paper"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <OptionToggleButton
              active={Boolean(config.showBio ?? true)}
              label="Описание (био) мастера"
              description="Показывать опыт и специализацию"
              onClick={() => setConfig({ ...config, showBio: !(config.showBio ?? true) })}
            />
            <OptionToggleButton
              active={Boolean(config.showNextSlots ?? true)}
              label="Свободные окошки времени"
              description="Кнопки быстрой записи на карточке мастера"
              onClick={() =>
                setConfig({ ...config, showNextSlots: !(config.showNextSlots ?? true) })
              }
            />
          </div>
        </>
      )}

      {section.type === "contacts" && (
        <>
          <div>
            <label className="label-base">Заголовок блока</label>
            <input
              type="text"
              value={String(config.title ?? "Контакты")}
              onChange={(e) => setConfig({ ...config, title: e.target.value })}
              className="input-base"
            />
            <QuickTextChips
              options={["Контакты", "Как нас найти", "Адрес и связь"]}
              currentValue={String(config.title ?? "Контакты")}
              onSelect={(val) => setConfig({ ...config, title: val })}
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <OptionToggleButton
              active={Boolean(config.showAddress ?? true)}
              label="Показывать адрес"
              description="Адрес и город из настроек профиля"
              onClick={() =>
                setConfig({ ...config, showAddress: !(config.showAddress ?? true) })
              }
            />
            <OptionToggleButton
              active={Boolean(config.showPhone ?? true)}
              label="Показывать телефон"
              description="Кнопка быстрого набора номера"
              onClick={() =>
                setConfig({ ...config, showPhone: !(config.showPhone ?? true) })
              }
            />
            <OptionToggleButton
              active={Boolean(config.showInstagram ?? true)}
              label="Ссылка на Instagram"
              description="Переход в ваш профиль Instagram"
              onClick={() =>
                setConfig({ ...config, showInstagram: !(config.showInstagram ?? true) })
              }
            />
            <OptionToggleButton
              active={Boolean(config.showWebsite ?? true)}
              label="Дополнительный сайт"
              description="Ссылка на внешний сайт, если указан"
              onClick={() =>
                setConfig({ ...config, showWebsite: !(config.showWebsite ?? true) })
              }
            />
          </div>
        </>
      )}

      {section.type === "gallery" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label-base">Заголовок галереи</label>
              <input
                type="text"
                value={String(config.title ?? "Наши работы")}
                onChange={(e) => setConfig({ ...config, title: e.target.value })}
                className="input-base"
              />
              <QuickTextChips
                options={["Наши работы", "Портфолио", "До и После", "Атмосфера и работы"]}
                currentValue={String(config.title ?? "Наши работы")}
                onSelect={(val) => setConfig({ ...config, title: val })}
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
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/25 bg-brand-soft/40 p-3.5">
            <p className="text-[12px] text-brand-dark">
              Сами фотографии работ загружаются и удаляются во вкладке <b>«Галерея»</b>.
            </p>
            {onOpenGallery && (
              <button
                type="button"
                onClick={onOpenGallery}
                className="btn btn-secondary h-8 px-3 text-[11.5px]"
              >
                <ImageIcon size={13} /> Перейти к загрузке фото
              </button>
            )}
          </div>
        </>
      )}

      {section.type === "promotions" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label-base">Заголовок блока акций</label>
              <input
                type="text"
                value={String(config.title ?? "Акции")}
                onChange={(e) => setConfig({ ...config, title: e.target.value })}
                className="input-base"
              />
              <QuickTextChips
                options={["Акции", "Спецпредложения", "Скидки и бонусы"]}
                currentValue={String(config.title ?? "Акции")}
                onSelect={(val) => setConfig({ ...config, title: val })}
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
          </div>

          <ItemList
            items={items}
            onChange={(next) => setConfig({ ...config, items: next })}
            templates={PROMO_TEMPLATES}
            fields={[
              { key: "title", label: "Название акции", placeholder: "Скидка −15% на первый визит" },
              { key: "serviceCategory", label: "Метка / Категория", placeholder: "Новым клиентам" },
              { key: "validUntil", label: "Действует до (необязательно)", type: "date" },
              {
                key: "description",
                label: "Описание и условия",
                type: "textarea",
                placeholder: "Коротко опишите условия акции",
              },
            ]}
            blank={{ title: "", serviceCategory: "", validUntil: "", description: "" }}
            addLabel="Добавить свою акцию"
          />
        </>
      )}

      {section.type === "reviews" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label-base">Заголовок блока отзывов</label>
              <input
                type="text"
                value={String(config.title ?? "Отзывы")}
                onChange={(e) => setConfig({ ...config, title: e.target.value })}
                className="input-base"
              />
              <QuickTextChips
                options={["Отзывы", "Отзывы гостей", "Нам доверяют"]}
                currentValue={String(config.title ?? "Отзывы")}
                onSelect={(val) => setConfig({ ...config, title: val })}
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
          </div>

          <ItemList
            items={items}
            onChange={(next) => setConfig({ ...config, items: next })}
            templates={REVIEW_TEMPLATES}
            fields={[
              { key: "name", label: "Имя клиента", placeholder: "Дилноза" },
              { key: "date", label: "Дата", type: "date" },
              { key: "rating", label: "Оценка (нажмите на кнопку)", type: "rating", wide: true },
              {
                key: "text",
                label: "Текст отзыва",
                type: "textarea",
                placeholder: "Что понравилось клиенту?",
              },
            ]}
            blank={{
              name: "",
              rating: 5,
              date: new Date().toISOString().slice(0, 10),
              text: "",
            }}
            addLabel="Добавить отзыв клиента"
          />
        </>
      )}

      {section.type === "faq" && (
        <>
          <div>
            <label className="label-base">Заголовок блока вопросов</label>
            <input
              type="text"
              value={String(config.title ?? "Частые вопросы")}
              onChange={(e) => setConfig({ ...config, title: e.target.value })}
              className="input-base"
            />
            <QuickTextChips
              options={["Частые вопросы", "Вопросы и ответы", "Полезно знать перед визитом"]}
              currentValue={String(config.title ?? "Частые вопросы")}
              onSelect={(val) => setConfig({ ...config, title: val })}
            />
          </div>

          <ItemList
            items={items}
            onChange={(next) => setConfig({ ...config, items: next })}
            templates={FAQ_TEMPLATES}
            fields={[
              {
                key: "question",
                label: "Вопрос клиента",
                placeholder: "Как перенести или отменить запись?",
                wide: true,
              },
              {
                key: "answer",
                label: "Ответ",
                type: "textarea",
                placeholder: "Короткий и понятный ответ",
              },
            ]}
            blank={{ question: "", answer: "" }}
            addLabel="Добавить свой вопрос"
          />
        </>
      )}

      {section.type === "vacancies" && (
        <>
          <div>
            <label className="label-base">Заголовок блока вакансий</label>
            <input
              type="text"
              value={String(config.title ?? "Вакансии")}
              onChange={(e) => setConfig({ ...config, title: e.target.value })}
              className="input-base"
            />
            <QuickTextChips
              options={["Вакансии", "Ищем в команду", "Работа у нас"]}
              currentValue={String(config.title ?? "Вакансии")}
              onSelect={(val) => setConfig({ ...config, title: val })}
            />
          </div>

          <ItemList
            items={items}
            onChange={(next) => setConfig({ ...config, items: next })}
            templates={VACANCY_TEMPLATES}
            fields={[
              { key: "title", label: "Должность", placeholder: "Мастер маникюра / Стилист" },
              { key: "requirements", label: "Требования", placeholder: "Опыт от 1 года" },
              {
                key: "description",
                label: "Условия работы",
                type: "textarea",
                placeholder: "График, оплата, преимущества работы в вашем салоне",
              },
            ]}
            blank={{ title: "", requirements: "", description: "" }}
            addLabel="Добавить вакансию"
          />
        </>
      )}

      {section.type === "custom_html" && (
        <>
          <div>
            <label className="label-base">Произвольный текст или HTML-код блока</label>
            <div className="mb-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setConfig({
                    ...config,
                    html: `<h3>О нашем салоне</h3><p>Мы создали пространство, где вы можете расслабиться и доверить заботу о себе профессионалам. Используем только сертифицированные материалы и одноразовые расходники.</p>`,
                  })
                }
                className="rounded-lg border border-brand/30 bg-brand-soft/40 px-2.5 py-1 text-[11px] font-medium text-brand-dark hover:bg-brand-soft"
              >
                + Вставить шаблон «О нашем салоне»
              </button>
              <button
                type="button"
                onClick={() =>
                  setConfig({
                    ...config,
                    html: `<h3>Правила посещения</h3><ul><li>Пожалуйста, приходите за 5–10 минут до начала записи.</li><li>При опоздании более чем на 15 минут мы можем предложить сокращённую процедуру.</li></ul>`,
                  })
                }
                className="rounded-lg border border-brand/30 bg-brand-soft/40 px-2.5 py-1 text-[11px] font-medium text-brand-dark hover:bg-brand-soft"
              >
                + Вставить шаблон «Правила посещения»
              </button>
            </div>
            <textarea
              value={String(config.html ?? "")}
              onChange={(e) => setConfig({ ...config, html: e.target.value })}
              rows={5}
              className="input-base h-auto resize-y font-mono text-[12px]"
              placeholder="<div><h3>О нас</h3><p>Ваш текст...</p></div>"
            />
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-ghost h-10 px-4 text-[12.5px]"
        >
          Свернуть без сохранения
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => onSave(config)}
          className="btn btn-primary h-10 px-5 text-[12.5px]"
        >
          <Check size={15} /> {isSaving ? "Сохраняем..." : "Сохранить настройки блока"}
        </button>
      </div>
    </div>
  );
}

function SectionCard({
  section,
  index,
  total,
  isExpanded,
  isSaving,
  onToggleExpand,
  onToggleEnabled,
  onMoveUp,
  onMoveDown,
  onDelete,
  onSaveConfig,
  onOpenGallery,
}: {
  section: PageSection;
  index: number;
  total: number;
  isExpanded: boolean;
  isSaving: boolean;
  onToggleExpand: () => void;
  onToggleEnabled: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onSaveConfig: (config: Record<string, unknown>) => void;
  onOpenGallery?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });

  const typeInfo = SECTION_TYPES.find((t) => t.type === section.type);
  const Icon = typeInfo?.icon ?? LayoutDashboard;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  };

  // Summary badge for items count if applicable
  const items = configItems(section.config);
  const needsItems = ["reviews", "promotions", "faq", "vacancies"].includes(section.type);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-[22px] border transition-all duration-200 ${
        isDragging
          ? "border-brand bg-white shadow-lift ring-2 ring-brand/30"
          : isExpanded
          ? "border-brand/50 bg-white shadow-soft ring-1 ring-brand/20"
          : section.enabled
          ? "border-line bg-white hover:border-brand/30"
          : "border-line/70 bg-paper/60 opacity-75"
      } p-3.5 sm:p-4`}
    >
      {/* Top Row: Icon, Title, Order Badge */}
      <div className="flex items-start gap-3">
        {/* Desktop drag handle inside card (never clipped on mobile) */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="hidden sm:grid size-9 shrink-0 cursor-grab place-items-center rounded-xl bg-paper text-muted hover:bg-brand-soft hover:text-brand active:cursor-grabbing"
          title="Перетащить мышкой"
        >
          <GripVertical size={16} strokeWidth={1.7} />
        </button>

        <span
          className={`grid size-10 shrink-0 place-items-center rounded-xl ${
            section.enabled ? "bg-brand-soft text-brand" : "bg-paper text-muted"
          }`}
        >
          <Icon size={18} strokeWidth={1.7} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-paper px-1.5 py-0.5 text-[10.5px] font-bold text-muted">
              #{index + 1}
            </span>
            <p className="text-[14px] font-semibold text-ink">
              {typeInfo?.label ?? section.type}
            </p>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                section.enabled ? "bg-mint/15 text-mint" : "bg-line/60 text-muted"
              }`}
            >
              {section.enabled ? "Показывается на сайте" : "Скрыт"}
            </span>
            {needsItems && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  items.length > 0
                    ? "bg-brand-soft text-brand-dark"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {items.length > 0 ? `Записей: ${items.length}` : "Пусто — нажмите «Настроить»"}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[12px] text-muted">{typeInfo?.description ?? ""}</p>
        </div>
      </div>

      {/* Action Buttons Row — Large, obvious tap targets for mobile & desktop */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-3">
        {/* Up / Down order buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={index === 0 || isSaving}
            onClick={onMoveUp}
            className="inline-flex h-9 items-center gap-1 rounded-xl border border-line bg-paper px-2.5 text-[12px] font-medium text-ink transition-all hover:bg-white active:scale-95 disabled:opacity-35"
            title="Поднять блок выше"
          >
            <ArrowUp size={14} /> <span className="hidden xs:inline">Выше</span>
          </button>
          <button
            type="button"
            disabled={index === total - 1 || isSaving}
            onClick={onMoveDown}
            className="inline-flex h-9 items-center gap-1 rounded-xl border border-line bg-paper px-2.5 text-[12px] font-medium text-ink transition-all hover:bg-white active:scale-95 disabled:opacity-35"
            title="Опустить блок ниже"
          >
            <ArrowDown size={14} /> <span className="hidden xs:inline">Ниже</span>
          </button>
        </div>

        {/* Toggle visibility, Expand settings, Delete */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={isSaving}
            onClick={onToggleEnabled}
            className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[12px] font-semibold transition-all active:scale-95 ${
              section.enabled
                ? "border-line bg-white text-ink hover:bg-paper"
                : "border-mint/30 bg-mint/10 text-mint hover:bg-mint/20"
            }`}
          >
            {section.enabled ? (
              <>
                <EyeOff size={14} /> Скрыть
              </>
            ) : (
              <>
                <Eye size={14} /> Включить
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onToggleExpand}
            className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-[12px] font-semibold transition-all active:scale-95 ${
              isExpanded
                ? "bg-ink text-white"
                : "bg-brand-soft text-brand-dark hover:bg-brand hover:text-white"
            }`}
          >
            <Settings2 size={14} />
            {isExpanded ? "Свернуть" : "Настроить"}
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={onDelete}
            className="grid size-9 place-items-center rounded-xl border border-line/70 text-muted transition-colors hover:border-rose/30 hover:bg-rose/10 hover:text-rose"
            title="Удалить блок со страницы"
            aria-label="Удалить блок"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Inline Settings Accordion */}
      {isExpanded && (
        <InlineSectionEditor
          key={`${section.id}-${JSON.stringify(section.config)}`}
          section={section}
          isSaving={isSaving}
          onCancel={onToggleExpand}
          onSave={onSaveConfig}
          onOpenGallery={onOpenGallery}
        />
      )}
    </div>
  );
}

export function SectionManager({
  initialSections,
  onOpenGallery,
  onOpenPreview,
}: {
  initialSections: PageSection[];
  onOpenGallery?: () => void;
  onOpenPreview?: () => void;
}) {
  const [sections, setSections] = useState<PageSection[]>(() =>
    [...initialSections].sort((a, b) => a.sortOrder - b.sortOrder),
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function flashStatus(msg: string) {
    setStatusMessage(msg);
    setTimeout(() => {
      setStatusMessage((prev) => (prev === msg ? null : prev));
    }, 2600);
  }

  function handleApplyPreset(presetId: string, presetTitle: string) {
    startTransition(async () => {
      const res = await applyPagePresetAction(presetId);
      if (res?.ok && res.sections) {
        setSections(
          res.sections.map((s) => ({
            id: s.id,
            businessId: s.businessId,
            type: s.type,
            enabled: s.enabled,
            sortOrder: s.sortOrder,
            config: (s.config ?? {}) as Record<string, unknown>,
            createdAt:
              s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt),
            updatedAt:
              s.updatedAt instanceof Date ? s.updatedAt.toISOString() : String(s.updatedAt),
          })),
        );
        setExpandedId(null);
        flashStatus(`Шаблон «${presetTitle}» применён!`);
      }
    });
  }

  function handleQuickBlockTap(type: string) {
    const existing = sections.find((s) => s.type === type);
    const typeInfo = SECTION_TYPES.find((t) => t.type === type);
    if (!typeInfo) return;

    startTransition(async () => {
      if (existing) {
        // Toggle enabled state in 1 tap
        const nextEnabled = !existing.enabled;
        const formData = new FormData();
        formData.append("sectionId", existing.id);
        formData.append("type", existing.type);
        formData.append("enabled", String(nextEnabled));
        formData.append("sortOrder", String(existing.sortOrder));
        formData.append("config", JSON.stringify(existing.config));
        const res = await updateSectionAction(null, formData);
        if (res?.ok) {
          setSections((prev) =>
            prev.map((s) => (s.id === existing.id ? { ...s, enabled: nextEnabled } : s)),
          );
          if (nextEnabled) {
            setExpandedId(existing.id);
          }
          flashStatus(
            nextEnabled
              ? `Блок «${typeInfo.shortLabel}» включён`
              : `Блок «${typeInfo.shortLabel}» скрыт`,
          );
        }
      } else {
        // Create and enable immediately
        const maxOrder = Math.max(...sections.map((s) => s.sortOrder), -1);
        const formData = new FormData();
        formData.append("type", type);
        formData.append("enabled", "true");
        formData.append("sortOrder", String(maxOrder + 1));
        formData.append("config", JSON.stringify(typeInfo.defaultConfig));

        const res = await createSectionAction(null, formData);
        if (res?.ok && res.sectionId) {
          const newSection: PageSection = {
            id: res.sectionId,
            businessId: "",
            type,
            enabled: true,
            sortOrder: maxOrder + 1,
            config: { ...typeInfo.defaultConfig },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setSections((prev) => [...prev, newSection].sort((a, b) => a.sortOrder - b.sortOrder));
          setExpandedId(newSection.id);
          flashStatus(`Блок «${typeInfo.shortLabel}» добавлен на страницу`);
        }
      }
    });
  }

  function handleToggleEnabled(id: string) {
    const section = sections.find((s) => s.id === id);
    if (!section) return;
    const nextEnabled = !section.enabled;

    startTransition(async () => {
      const formData = new FormData();
      formData.append("sectionId", id);
      formData.append("type", section.type);
      formData.append("enabled", String(nextEnabled));
      formData.append("sortOrder", String(section.sortOrder));
      formData.append("config", JSON.stringify(section.config));
      const res = await updateSectionAction(null, formData);
      if (res?.ok) {
        setSections((prev) =>
          prev.map((s) => (s.id === id ? { ...s, enabled: nextEnabled } : s)),
        );
        flashStatus(nextEnabled ? "Блок включён" : "Блок скрыт");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("sectionId", id);
      const res = await deleteSectionAction(null, formData);
      if (res?.ok) {
        setSections((prev) => prev.filter((s) => s.id !== id));
        if (expandedId === id) setExpandedId(null);
        flashStatus("Блок удалён");
      }
    });
  }

  function persistOrder(reordered: PageSection[]) {
    setSections(reordered);
    startTransition(async () => {
      const order = reordered.map((s, i) => ({ id: s.id, sortOrder: i }));
      const formData = new FormData();
      formData.append("order", JSON.stringify(order));
      await reorderSectionsAction(null, formData);
      flashStatus("Порядок блоков сохранён");
    });
  }

  function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const next = arrayMove(sections, index, target).map((s, i) => ({ ...s, sortOrder: i }));
    persistOrder(next);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = sections.findIndex((s) => s.id === active.id);
      const newIndex = sections.findIndex((s) => s.id === over.id);
      const next = arrayMove(sections, oldIndex, newIndex).map((s, i) => ({
        ...s,
        sortOrder: i,
      }));
      persistOrder(next);
    }
  }

  function handleSaveConfig(id: string, config: Record<string, unknown>) {
    const section = sections.find((s) => s.id === id);
    if (!section) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.append("sectionId", section.id);
      formData.append("type", section.type);
      formData.append("enabled", String(section.enabled));
      formData.append("sortOrder", String(section.sortOrder));
      formData.append("config", JSON.stringify(config));
      const res = await updateSectionAction(null, formData);
      if (res?.ok) {
        setSections((prev) => prev.map((s) => (s.id === id ? { ...s, config } : s)));
        setExpandedId(null);
        flashStatus("Настройки блока сохранены!");
      }
    });
  }

  const enabledList = sections.filter((s) => s.enabled);

  return (
    <div className="space-y-6">
      {/* Floating / Sticky Status Toast */}
      {statusMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-2xl bg-ink px-4 py-3 text-[12.5px] font-semibold text-white shadow-lift">
          <Check size={15} className="text-mint" />
          {statusMessage}
        </div>
      )}

      {/* STEP 1: 1-TAP READY TEMPLATES */}
      <div className="rounded-[24px] border border-line bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-0.5 text-[10.5px] font-bold tracking-wider text-brand-dark uppercase">
              <Wand2 size={12} /> Шаг 1 · Быстрый старт
            </span>
            <h2 className="mt-1.5 text-[16px] font-semibold text-ink">
              Готовые варианты лендинга в 1 нажатие
            </h2>
            <p className="mt-0.5 text-[12px] text-muted">
              Выберите подходящую структуру страницы — блоки автоматически выстроятся в нужном порядке (ваши тексты и настройки сохранятся).
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {PAGE_PRESETS.map((preset) => {
            const Icon = preset.icon;
            return (
              <button
                key={preset.id}
                type="button"
                disabled={isPending}
                onClick={() => handleApplyPreset(preset.id, preset.title)}
                className="group flex flex-col justify-between rounded-2xl border border-line bg-paper/40 p-3.5 text-left transition-all hover:border-brand hover:bg-brand-soft/25 hover:shadow-xs active:scale-[0.98] disabled:opacity-50"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand group-hover:bg-brand group-hover:text-white transition-colors">
                      <Icon size={17} />
                    </span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-muted ring-1 ring-line">
                      {preset.badge}
                    </span>
                  </div>
                  <p className="mt-2.5 text-[13.5px] font-semibold text-ink">{preset.title}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">
                    {preset.description}
                  </p>
                </div>
                <span className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand">
                  Применить шаблон →
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* STEP 2: 1-TAP BLOCK TOGGLE PALETTE */}
      <div className="rounded-[24px] border border-line bg-white p-4 sm:p-5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-0.5 text-[10.5px] font-bold tracking-wider text-brand-dark uppercase">
          <Plus size={12} /> Шаг 2 · Включение нужных блоков
        </span>
        <h2 className="mt-1.5 text-[16px] font-semibold text-ink">
          Нажмите на кнопку блока, чтобы включить или скрыть его
        </h2>
        <p className="mt-0.5 text-[12px] text-muted">
          Зелёная галочка означает, что блок сейчас включён на вашей странице.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {SECTION_TYPES.map((t) => {
            const existing = sections.find((s) => s.type === t.type);
            const isActive = Boolean(existing?.enabled);
            const Icon = t.icon;

            return (
              <button
                key={t.type}
                type="button"
                disabled={isPending}
                onClick={() => handleQuickBlockTap(t.type)}
                className={`flex items-center gap-2.5 rounded-2xl border p-3 text-left transition-all active:scale-95 disabled:opacity-50 ${
                  isActive
                    ? "border-brand bg-brand-soft/40 text-ink shadow-2xs"
                    : "border-line bg-paper/40 text-muted hover:border-brand/40 hover:bg-white hover:text-ink"
                }`}
              >
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-xl transition-colors ${
                    isActive ? "bg-brand text-white" : "bg-white text-muted ring-1 ring-line"
                  }`}
                >
                  {isActive ? <Check size={15} strokeWidth={2.4} /> : <Icon size={15} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold text-ink">{t.shortLabel}</p>
                  <p className="text-[10.5px] text-muted">
                    {isActive ? "Включён" : "Выключен"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* STEP 3: ORDERING & DETAILED SETTINGS + VISUAL MINI-MAP */}
      <div className="grid gap-6 lg:grid-cols-[1fr_290px]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-0.5 text-[10.5px] font-bold tracking-wider text-brand-dark uppercase">
                <Settings2 size={12} /> Шаг 3 · Порядок и содержимое
              </span>
              <h2 className="mt-1 text-[16px] font-semibold text-ink">
                Последовательность блоков на странице ({enabledList.length} активных)
              </h2>
              <p className="text-[12px] text-muted">
                Меняйте порядок кнопками <b>«↑ Выше» / «↓ Ниже»</b> и нажимайте <b>«Настроить»</b>, чтобы изменить заголовки, кнопки или добавить акции и отзывы.
              </p>
            </div>
          </div>

          {sections.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-line bg-white px-6 py-12 text-center">
              <p className="text-[15px] font-semibold">На странице пока нет блоков</p>
              <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted">
                Выберите любой готовый шаблон в «Шаге 1» или нажмите на нужные блоки в «Шаге 2».
              </p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sections.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {sections.map((section, index) => (
                    <SectionCard
                      key={section.id}
                      section={section}
                      index={index}
                      total={sections.length}
                      isExpanded={expandedId === section.id}
                      isSaving={isPending}
                      onToggleExpand={() =>
                        setExpandedId((prev) => (prev === section.id ? null : section.id))
                      }
                      onToggleEnabled={() => handleToggleEnabled(section.id)}
                      onMoveUp={() => handleMove(index, -1)}
                      onMoveDown={() => handleMove(index, 1)}
                      onDelete={() => handleDelete(section.id)}
                      onSaveConfig={(cfg) => handleSaveConfig(section.id, cfg)}
                      onOpenGallery={onOpenGallery}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* Visual Mobile Structure Mini-Map */}
        <div className="lg:sticky lg:top-6 h-fit rounded-[24px] border border-line bg-white p-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-line">
            <div className="flex items-center gap-2">
              <Smartphone size={16} className="text-brand" />
              <span className="text-[13px] font-semibold text-ink">Схема вашего сайта</span>
            </div>
            <span className="rounded-full bg-paper px-2 py-0.5 text-[10.5px] font-semibold text-muted">
              Сверху вниз
            </span>
          </div>

          <div className="mt-3 rounded-[20px] border-2 border-ink/80 bg-paper/70 p-2.5">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-ink/20" />
            {enabledList.length === 0 ? (
              <p className="py-8 text-center text-[11px] text-muted">
                Нет активных блоков
              </p>
            ) : (
              <div className="space-y-1.5">
                {enabledList.map((sec, idx) => {
                  const info = SECTION_TYPES.find((t) => t.type === sec.type);
                  const Icon = info?.icon ?? LayoutDashboard;
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => setExpandedId(sec.id)}
                      className={`flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-[11.5px] transition-all ${
                        expandedId === sec.id
                          ? "border-brand bg-brand text-white"
                          : "border-line/80 bg-white text-ink hover:border-brand/40"
                      }`}
                    >
                      <span className="font-mono text-[10px] opacity-60">{idx + 1}.</span>
                      <Icon size={13} className="shrink-0" />
                      <span className="truncate font-medium">
                        {info?.shortLabel ?? sec.type}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {onOpenPreview && (
            <button
              type="button"
              onClick={onOpenPreview}
              className="btn btn-primary mt-3 h-10 w-full gap-1.5 text-[12px]"
            >
              <Eye size={14} /> Открыть живой предпросмотр
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
