"use client";

import { useState, useTransition } from "react";
import { useActionState } from "react";
import {
  Check,
  ImagePlus,
  Loader2,
  Moon,
  Save,
  Sparkles,
  Sun,
  Trash2,
  Type,
  Upload,
} from "lucide-react";
import {
  updateThemeAction,
  uploadBrandImageAction,
  type ThemeState,
} from "@/server/actions/theme";

const PRESETS = [
  { name: "Фиолетовый", color: "#7c5cff" },
  { name: "Изумруд", color: "#12b886" },
  { name: "Коралл", color: "#f04d6a" },
  { name: "Янтарь", color: "#f5a524" },
  { name: "Индиго", color: "#4f6ef7" },
  { name: "Роза", color: "#ec4899" },
  { name: "Графит", color: "#0b0b10" },
  { name: "Терракота", color: "#c2683f" },
];

const FONTS = [
  { value: 0, title: "Авто", hint: "Подберём под тип бизнеса" },
  { value: 1, title: "Современный", hint: "Без засечек, чёткий" },
  { value: 2, title: "Элегантный", hint: "С засечками, для салонов" },
];

export function ThemeCustomizer({
  businessId,
  accent,
  mode,
  fontPair,
  coverUrl,
  logoUrl,
}: {
  businessId: string;
  accent: string;
  mode: "light" | "dark";
  fontPair: number;
  coverUrl: string | null;
  logoUrl: string | null;
}) {
  const [state, formAction, pending] = useActionState<ThemeState, FormData>(updateThemeAction, null);
  const [color, setColor] = useState(accent);
  const [themeMode, setThemeMode] = useState<"light" | "dark">(mode);
  const [font, setFont] = useState(fontPair);
  const [cover, setCover] = useState(coverUrl ?? "");
  const [logo, setLogo] = useState(logoUrl ?? "");
  const [uploading, setUploading] = useState<"cover" | "logo" | null>(null);
  const [, startUpload] = useTransition();

  function upload(kind: "cover" | "logo", file: File | null) {
    if (!file) return;
    setUploading(kind);
    startUpload(async () => {
      const formData = new FormData();
      formData.append("file", file);
      const result = await uploadBrandImageAction(kind, formData);
      setUploading(null);
      if (result?.url) {
        if (kind === "cover") setCover(result.url);
        else setLogo(result.url);
      }
    });
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="accent" value={color} />
      <input type="hidden" name="mode" value={themeMode} />
      <input type="hidden" name="fontPair" value={font} />
      <input type="hidden" name="coverUrl" value={cover} />
      <input type="hidden" name="logoUrl" value={logo} />

      <section className="rounded-[20px] bg-white p-5 ring-1 ring-line/80">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">Цвет</p>
        <p className="mt-1 text-[13px] font-semibold">Акцентный цвет страницы</p>
        <p className="mt-1 text-[12px] text-muted">
          Используется в кнопках, ссылках и выделениях. Выберите готовый или свой.
        </p>

        <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8">
          {PRESETS.map((preset) => {
            const selected = color.toLowerCase() === preset.color.toLowerCase();
            return (
              <button
                key={preset.name}
                type="button"
                onClick={() => setColor(preset.color)}
                className={`group relative aspect-square rounded-xl ring-2 transition-all ${
                  selected ? "ring-ink" : "ring-transparent hover:ring-ink/20"
                }`}
                style={{ background: preset.color }}
                title={preset.name}
                aria-label={preset.name}
              >
                {selected && (
                  <Check
                    size={16}
                    strokeWidth={2.5}
                    className="absolute inset-0 m-auto text-white drop-shadow"
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[12px] text-muted">
            Свой цвет
            <input
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              className="h-9 w-12 cursor-pointer rounded-lg border border-line bg-white p-1"
            />
          </label>
          <input
            value={color}
            onChange={(event) => {
              const value = event.target.value;
              setColor(value);
            }}
            onBlur={() => {
              if (!/^#[0-9a-fA-F]{6}$/.test(color)) setColor(accent);
            }}
            maxLength={7}
            className="input-base h-9 w-[110px] font-mono text-[12px] uppercase"
            aria-label="HEX цвет"
          />
        </div>
      </section>

      <section className="rounded-[20px] bg-white p-5 ring-1 ring-line/80">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
          Настроение
        </p>
        <p className="mt-1 text-[13px] font-semibold">Светлая или тёмная страница</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(
            [
              { value: "light" as const, title: "Светлая", hint: "Чистая, воздушная", icon: Sun },
              { value: "dark" as const, title: "Тёмная", hint: "Премиальная, вечерняя", icon: Moon },
            ] satisfies Array<{ value: "light" | "dark"; title: string; hint: string; icon: typeof Sun }>
          ).map((option) => {
            const selected = themeMode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setThemeMode(option.value)}
                className={`relative rounded-2xl border-2 p-4 text-left transition-all ${
                  selected ? "border-brand bg-brand-soft/40" : "border-line hover:border-brand/30"
                }`}
              >
                <option.icon size={18} className="text-brand" strokeWidth={1.7} />
                <p className="mt-2 text-[13px] font-semibold">{option.title}</p>
                <p className="text-[11.5px] text-muted">{option.hint}</p>
                <div
                  className={`mt-3 h-10 rounded-lg ring-1 ring-line/70 ${
                    option.value === "light" ? "bg-[#fcfbfa]" : "bg-[#111118]"
                  }`}
                >
                  <div className="ml-2 mt-2 h-2 w-10 rounded-full" style={{ background: color }} />
                  <div className="ml-2 mt-1 h-1.5 w-16 rounded-full bg-current opacity-10" />
                </div>
                {selected && (
                  <span className="absolute top-3 right-3 grid size-5 place-items-center rounded-full bg-brand text-white">
                    <Check size={12} strokeWidth={2.5} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-[20px] bg-white p-5 ring-1 ring-line/80">
        <div className="flex items-center gap-2">
          <Type size={15} className="text-muted" strokeWidth={1.7} />
          <p className="text-[13px] font-semibold">Шрифт заголовков</p>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {FONTS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFont(option.value)}
              className={`rounded-xl border-2 p-3 text-left transition-all ${
                font === option.value ? "border-brand bg-brand-soft/30" : "border-line hover:border-brand/30"
              }`}
            >
              <p className="text-[12.5px] font-semibold">{option.title}</p>
              <p className="text-[11px] text-muted">{option.hint}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[20px] bg-white p-5 ring-1 ring-line/80">
        <div className="flex items-center gap-2">
          <ImagePlus size={15} className="text-muted" strokeWidth={1.7} />
          <p className="text-[13px] font-semibold">Обложка и логотип</p>
        </div>
        <p className="mt-1 text-[11.5px] text-muted">
          Обложка — широкое фото под шапкой. Логотип — круглая аватарка рядом с названием.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-paper p-3">
            <p className="text-[11.5px] font-semibold">Обложка</p>
            {cover ? (
              <div className="relative mt-2 overflow-hidden rounded-xl ring-1 ring-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cover} alt="Обложка" className="aspect-[3/1] w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setCover("")}
                  className="absolute top-2 right-2 grid size-7 place-items-center rounded-lg bg-white/90 text-rose"
                  aria-label="Удалить обложку"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ) : (
              <div className="mt-2 grid aspect-[3/1] place-items-center rounded-xl border border-dashed border-line text-[11px] text-muted">
                Нет обложки
              </div>
            )}
            <label className="btn btn-ghost mt-2 h-9 w-full cursor-pointer text-[11.5px]">
              {uploading === "cover" ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Upload size={13} />
              )}
              Загрузить обложку
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => upload("cover", event.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <div className="rounded-2xl bg-paper p-3">
            <p className="text-[11.5px] font-semibold">Логотип</p>
            {logo ? (
              <div className="relative mt-2 grid aspect-[3/1] place-items-center rounded-xl ring-1 ring-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logo} alt="Логотип" className="size-16 object-contain" />
                <button
                  type="button"
                  onClick={() => setLogo("")}
                  className="absolute top-2 right-2 grid size-7 place-items-center rounded-lg bg-white/90 text-rose"
                  aria-label="Удалить логотип"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ) : (
              <div className="mt-2 grid aspect-[3/1] place-items-center rounded-xl border border-dashed border-line text-[11px] text-muted">
                Нет логотипа
              </div>
            )}
            <label className="btn btn-ghost mt-2 h-9 w-full cursor-pointer text-[11.5px]">
              {uploading === "logo" ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Upload size={13} />
              )}
              Загрузить логотип
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => upload("logo", event.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-3 rounded-[20px] bg-white p-4 ring-1 ring-line/80">
        {state?.error && (
          <p className="mr-auto rounded-xl border border-rose/20 bg-rose/5 px-3 py-2 text-[12px] text-rose">
            {state.error}
          </p>
        )}
        {state?.ok && (
          <p className="mr-auto inline-flex items-center gap-1.5 text-[12px] font-medium text-mint">
            <Sparkles size={13} /> Оформление сохранено
          </p>
        )}
        <button type="submit" disabled={pending} className="btn btn-primary h-10 px-5 text-[12.5px]">
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Сохранить оформление
        </button>
      </div>
    </form>
  );
}
