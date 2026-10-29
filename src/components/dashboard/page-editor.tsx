"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  Images,
  LayoutGrid,
  Monitor,
  Palette,
  QrCode,
  RefreshCw,
  Smartphone,
  Store,
  Tablet,
} from "lucide-react";
import type { GalleryImage } from "@/server/db/schema";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ProfileEditor, type ProfileBusiness } from "./profile-editor";
import { SectionManager, type PageSection } from "./section-manager";
import { ThemeCustomizer } from "./theme-customizer";
import { GalleryManager } from "./gallery-manager";
import { QRCodeDisplay } from "./qr-code";

const TABS = [
  { value: "blocks", label: "Конструктор блоков", sublabel: "Шаблоны и секции", icon: LayoutGrid },
  { value: "design", label: "Дизайн и цвета", sublabel: "Логотип, обложка, тема", icon: Palette },
  { value: "main", label: "Основное и контакты", sublabel: "Название, адрес, соцсети", icon: Store },
  { value: "gallery", label: "Галерея работ", sublabel: "Фото До / После", icon: Images },
  { value: "preview", label: "Предпросмотр", sublabel: "Как видят клиенты", icon: Eye },
  { value: "qr", label: "QR-код", sublabel: "Для печати в салоне", icon: QrCode },
] as const;

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className="btn btn-ghost h-9 px-3 text-[11.5px]"
    >
      {copied ? <Check size={13} className="text-mint" /> : <Copy size={13} />}
      {copied ? "Скопировано" : "Скопировать ссылку"}
    </button>
  );
}

export function PageEditor({
  business,
  publicUrl,
  servicesCount,
  staffCount,
  telegram,
  sections,
  galleryImages,
}: {
  business: ProfileBusiness & {
    id: string;
    theme: { accent: string; mode: "light" | "dark"; fontPair?: number };
  };
  publicUrl: string;
  servicesCount: number;
  staffCount: number;
  telegram: {
    configured: boolean;
    link: string | null;
    connected?: boolean;
    telegramId?: string | null;
  };
  sections: PageSection[];
  galleryImages: GalleryImage[];
}) {
  const [tab, setTab] = useState<string>("blocks");
  const [previewDevice, setPreviewDevice] = useState<"mobile" | "tablet" | "desktop">("mobile");
  const [iframeKey, setIframeKey] = useState(0);

  const enabledSections = sections.filter((section) => section.enabled).length;
  const galleryEnabled = sections.some((section) => section.type === "gallery" && section.enabled);

  // Quality Audit / Page Health Check (checks for empty sections and broken/missing data)
  const healthCheck = useMemo(() => {
    const checks: { label: string; ok: boolean; tip?: string; targetTab?: string }[] = [];

    // 1. Services
    checks.push({
      label: "Активные услуги",
      ok: servicesCount > 0,
      tip: servicesCount === 0 ? "Добавьте хотя бы одну услугу в разделе «Услуги»" : undefined,
    });

    // 2. Staff
    checks.push({
      label: "Команда мастеров",
      ok: staffCount > 0,
      tip: staffCount === 0 ? "Добавьте мастера для онлайн-записи" : undefined,
    });

    // 3. Contacts
    const hasPhone = Boolean(business.phone?.trim());
    const hasAddress = Boolean(business.address?.trim());
    checks.push({
      label: "Контакты (телефон и адрес)",
      ok: hasPhone && hasAddress,
      tip: !hasPhone || !hasAddress ? "Укажите телефон и адрес во вкладке «Основное и контакты»" : undefined,
      targetTab: "main",
    });

    // 4. Branding
    const hasLogoOrCover = Boolean(business.logoUrl || business.coverUrl);
    checks.push({
      label: "Брендинг (логотип / обложка)",
      ok: hasLogoOrCover,
      tip: !hasLogoOrCover ? "Загрузите логотип или обложку во вкладке «Дизайн и цвета»" : undefined,
      targetTab: "design",
    });

    // 5. Empty enabled sections check
    const emptyActiveSections: string[] = [];
    for (const s of sections) {
      if (!s.enabled) continue;
      const cfg = s.config as Record<string, unknown>;
      if (s.type === "reviews" && (!Array.isArray(cfg.items) || cfg.items.length === 0)) {
        emptyActiveSections.push("Отзывы");
      }
      if (s.type === "faq" && (!Array.isArray(cfg.items) || cfg.items.length === 0)) {
        emptyActiveSections.push("FAQ");
      }
      if (s.type === "gallery" && galleryImages.length === 0) {
        emptyActiveSections.push("Галерея");
      }
      if (s.type === "promotions" && (!Array.isArray(cfg.items) || cfg.items.length === 0)) {
        emptyActiveSections.push("Акции");
      }
    }

    checks.push({
      label: "Отсутствие пустых блоков",
      ok: emptyActiveSections.length === 0,
      tip:
        emptyActiveSections.length > 0
          ? `Заполните блоки «${emptyActiveSections.join(", ")}» в конструкторе (пока они пустые, клиенты их не видят)`
          : undefined,
      targetTab: emptyActiveSections.includes("Галерея") && emptyActiveSections.length === 1 ? "gallery" : "blocks",
    });

    const passedCount = checks.filter((c) => c.ok).length;
    const score = Math.round((passedCount / checks.length) * 100);

    return { checks, score, allOk: passedCount === checks.length };
  }, [servicesCount, staffCount, business, sections, galleryImages]);

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">
            Конструктор лендинга для записи
          </p>
          <h1 className="mt-1.5 text-[24px] sm:text-[26px] leading-tight font-semibold tracking-[-0.03em]">
            {business.name}
          </h1>
          <p className="mt-1 text-[12.5px] text-muted">
            {servicesCount} услуг · {staffCount} мастеров · {enabledSections} активных блоков ·{" "}
            {galleryImages.length} фото
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CopyLink url={publicUrl} />
          <button
            type="button"
            onClick={() => setTab("preview")}
            className="btn btn-secondary h-9 gap-1.5 px-3 text-[11.5px]"
          >
            <Eye size={13} /> Предпросмотр
          </button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary h-9 px-4 text-[11.5px]"
          >
            <ExternalLink size={13} /> Открыть сайт
          </a>
        </div>
      </div>

      {/* Page Health Check Banner */}
      <div
        className={`rounded-[20px] border p-4 text-xs transition-colors ${
          healthCheck.allOk
            ? "border-emerald-200 bg-emerald-50/60 text-emerald-900"
            : "border-amber-200 bg-amber-50/60 text-amber-900"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {healthCheck.allOk ? (
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle size={16} className="text-amber-600 shrink-0" />
            )}
            <span className="font-semibold">
              Готовность лендинга к приёму клиентов: {healthCheck.score}%
            </span>
          </div>
          <span className="text-[11px] opacity-80">
            {healthCheck.allOk ? "Все ключевые разделы заполнены" : "Нажмите на подсказку ниже, чтобы перейти к настройке"}
          </span>
        </div>

        {!healthCheck.allOk && (
          <div className="mt-2.5 flex flex-wrap gap-2 pt-2 border-t border-black/5 text-[11.5px]">
            {healthCheck.checks
              .filter((c) => !c.ok)
              .map((c, i) =>
                c.targetTab ? (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setTab(c.targetTab!)}
                    className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-left font-medium text-amber-950 shadow-2xs ring-1 ring-amber-300/60 transition-all hover:bg-amber-100/50 active:scale-95"
                  >
                    ⚠️ {c.tip || c.label} →
                  </button>
                ) : (
                  <span key={i} className="rounded-lg bg-white/70 px-2.5 py-1">
                    ⚠️ {c.tip || c.label}
                  </span>
                ),
              )}
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        {/* Mobile & Desktop Friendly Navigation Grid (all labels clearly visible on mobile!) */}
        <div
          role="tablist"
          className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
        >
          {TABS.map((item) => {
            const active = tab === item.value;
            const Icon = item.icon;
            return (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(item.value)}
                className={`flex items-center gap-2.5 rounded-2xl border p-3 text-left transition-all active:scale-[0.98] ${
                  active
                    ? "border-brand bg-ink text-white shadow-soft"
                    : "border-line bg-white text-ink hover:border-brand/40 hover:bg-paper/60"
                }`}
              >
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-xl ${
                    active ? "bg-brand text-white" : "bg-brand-soft text-brand"
                  }`}
                >
                  <Icon size={17} strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-semibold leading-snug">
                    {item.label}
                  </p>
                  <p
                    className={`truncate text-[10.5px] ${
                      active ? "text-white/70" : "text-muted"
                    }`}
                  >
                    {item.sublabel}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <TabsContent value="blocks">
          <SectionManager
            initialSections={sections}
            onOpenGallery={() => setTab("gallery")}
            onOpenPreview={() => setTab("preview")}
          />
        </TabsContent>

        <TabsContent value="design">
          <div className="mb-3 rounded-2xl bg-white px-4 py-3 text-[12.5px] text-muted ring-1 ring-line/70">
            Выберите фирменный цвет кнопок, светлую или тёмную тему, шрифт, а также загрузите логотип и обложку шапки.
          </div>
          <ThemeCustomizer
            businessId={business.id ?? ""}
            accent={business.theme.accent}
            mode={business.theme.mode}
            fontPair={business.theme.fontPair ?? 0}
            coverUrl={business.coverUrl}
            logoUrl={business.logoUrl}
          />
        </TabsContent>

        <TabsContent value="main">
          <div className="mb-3 rounded-2xl bg-white px-4 py-3 text-[12.5px] text-muted ring-1 ring-line/70">
            Название салона, описание, контакты, адрес и правила онлайн-записи.
          </div>
          <ProfileEditor
            business={business}
            publicUrl={publicUrl}
            servicesCount={servicesCount}
            staffCount={staffCount}
            telegram={telegram}
          />
        </TabsContent>

        <TabsContent value="gallery">
          <div className="mb-3 rounded-2xl bg-white px-4 py-3 text-[12.5px] text-muted ring-1 ring-line/70">
            Фото ваших работ и результаты «До / После». Автоматически отображаются в блоке «Галерея работ».
          </div>
          <GalleryManager initialImages={galleryImages} galleryEnabled={galleryEnabled} />
        </TabsContent>

        <TabsContent value="qr">
          <div className="mb-3 rounded-2xl bg-white px-4 py-3 text-[12.5px] text-muted ring-1 ring-line/70">
            Готовый QR-код вашей страницы записи. Скачайте PNG и разместите на ресепшене или визитке.
          </div>
          <QRCodeDisplay
            url={publicUrl}
            businessName={business.name}
            accent={business.theme.accent}
          />
        </TabsContent>

        {/* LIVE PREVIEW TAB */}
        <TabsContent value="preview">
          <div className="space-y-4">
            {/* Device Switcher Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3">
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPreviewDevice("mobile")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    previewDevice === "mobile"
                      ? "bg-ink text-white"
                      : "text-muted hover:bg-paper hover:text-ink"
                  }`}
                >
                  <Smartphone size={14} /> Смартфон (375px)
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice("tablet")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    previewDevice === "tablet"
                      ? "bg-ink text-white"
                      : "text-muted hover:bg-paper hover:text-ink"
                  }`}
                >
                  <Tablet size={14} /> Планшет (768px)
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice("desktop")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    previewDevice === "desktop"
                      ? "bg-ink text-white"
                      : "text-muted hover:bg-paper hover:text-ink"
                  }`}
                >
                  <Monitor size={14} /> ПК (100%)
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIframeKey((prev) => prev + 1)}
                  className="btn btn-ghost h-8 gap-1.5 px-2.5 text-xs"
                  title="Обновить предпросмотр"
                >
                  <RefreshCw size={13} /> Обновить
                </button>
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary h-8 gap-1 px-3 text-xs"
                >
                  <ExternalLink size={13} /> В новой вкладке
                </a>
              </div>
            </div>

            {/* Iframe Container */}
            <div className="grid place-items-center overflow-x-auto rounded-3xl border border-line bg-paper/60 p-3 sm:p-6">
              <div
                className={`overflow-hidden rounded-[32px] border-4 border-ink/80 bg-white shadow-2xl transition-all duration-300 ${
                  previewDevice === "mobile"
                    ? "w-full max-w-[375px] h-[720px]"
                    : previewDevice === "tablet"
                    ? "w-full max-w-[768px] h-[800px]"
                    : "w-full h-[850px]"
                }`}
              >
                <iframe
                  key={iframeKey}
                  src={publicUrl}
                  title="Предпросмотр страницы записи"
                  className="size-full border-0"
                />
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
