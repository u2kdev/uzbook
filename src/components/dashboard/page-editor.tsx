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
  ShieldCheck,
  Smartphone,
  Store,
  Tablet,
} from "lucide-react";
import type { GalleryImage } from "@/server/db/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileEditor, type ProfileBusiness } from "./profile-editor";
import { SectionManager, type PageSection } from "./section-manager";
import { ThemeCustomizer } from "./theme-customizer";
import { GalleryManager } from "./gallery-manager";
import { QRCodeDisplay } from "./qr-code";

const TABS = [
  { value: "main", label: "Основное", icon: Store },
  { value: "blocks", label: "Блоки", icon: LayoutGrid },
  { value: "design", label: "Дизайн", icon: Palette },
  { value: "gallery", label: "Галерея", icon: Images },
  { value: "qr", label: "QR-код", icon: QrCode },
  { value: "preview", label: "Предпросмотр", icon: Eye },
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
      {copied ? "Скопировано" : "Копировать ссылку"}
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
  telegram: { configured: boolean; link: string | null };
  sections: PageSection[];
  galleryImages: GalleryImage[];
}) {
  const [tab, setTab] = useState<string>("main");
  const [previewDevice, setPreviewDevice] = useState<"mobile" | "tablet" | "desktop">("mobile");
  const [iframeKey, setIframeKey] = useState(0);

  const enabledSections = sections.filter((section) => section.enabled).length;
  const galleryEnabled = sections.some((section) => section.type === "gallery" && section.enabled);

  // Quality Audit / Page Health Check (checks for empty sections and broken/missing data)
  const healthCheck = useMemo(() => {
    const checks: { label: string; ok: boolean; tip?: string }[] = [];

    // 1. Services
    checks.push({
      label: "Активные услуги",
      ok: servicesCount > 0,
      tip: servicesCount === 0 ? "Добавьте хотя бы одну услугу в каталоге" : undefined,
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
      tip: !hasPhone || !hasAddress ? "Укажите телефон и адрес для клиентов" : undefined,
    });

    // 4. Branding
    const hasLogoOrCover = Boolean(business.logoUrl || business.coverUrl);
    checks.push({
      label: "Брендинг (логотип / обложка)",
      ok: hasLogoOrCover,
      tip: !hasLogoOrCover ? "Загрузите логотип или обложку во вкладке «Дизайн»" : undefined,
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
          ? `Блоки «${emptyActiveSections.join(", ")}» включены, но не содержат контента (они автоматически скрыты от клиентов)`
          : undefined,
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
            Моя страница записи
          </p>
          <h1 className="mt-1.5 text-[26px] leading-tight font-semibold tracking-[-0.03em]">
            {business.name}
          </h1>
          <p className="mt-1 text-[12.5px] text-muted">
            {servicesCount} услуг · {staffCount} мастеров · {enabledSections} блоков ·{" "}
            {galleryImages.length} фото
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CopyLink url={publicUrl} />
          <button
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
            <ExternalLink size={13} /> Открыть страницу
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
              Готовность страницы к приёму клиентов: {healthCheck.score}%
            </span>
          </div>
          <span className="text-[11px] opacity-80">
            {healthCheck.allOk ? "Все ключевые разделы заполнены" : "Есть рекомендации по улучшению"}
          </span>
        </div>

        {!healthCheck.allOk && (
          <div className="mt-2.5 flex flex-wrap gap-2 pt-2 border-t border-black/5 text-[11px]">
            {healthCheck.checks
              .filter((c) => !c.ok)
              .map((c, i) => (
                <span key={i} className="rounded-md bg-white/70 px-2 py-0.5">
                  ⚠️ {c.tip || c.label}
                </span>
              ))}
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {TABS.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              <item.icon size={14} strokeWidth={1.7} />
              <span className="hidden sm:inline">{item.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="main">
          <div className="mb-3 rounded-xl bg-white px-4 py-3 text-[12px] text-muted ring-1 ring-line/70">
            Название, контакты, адрес и правила записи. Это видят клиенты на вашей странице.
          </div>
          <ProfileEditor
            business={business}
            publicUrl={publicUrl}
            servicesCount={servicesCount}
            staffCount={staffCount}
            telegram={telegram}
          />
        </TabsContent>

        <TabsContent value="blocks">
          <div className="mb-3 rounded-xl bg-white px-4 py-3 text-[12px] text-muted ring-1 ring-line/70">
            Блоки — это секции страницы сверху вниз. Перетаскивайте за ручку слева, чтобы менять
            порядок. Шестерёнка — текст и содержимое, глаз — скрыть/показать.
          </div>
          <SectionManager initialSections={sections} />
        </TabsContent>

        <TabsContent value="design">
          <div className="mb-3 rounded-xl bg-white px-4 py-3 text-[12px] text-muted ring-1 ring-line/70">
            Цвет, светлая или тёмная тема, шрифт, обложка и логотип. Здесь же можно загрузить фон.
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

        <TabsContent value="gallery">
          <div className="mb-3 rounded-xl bg-white px-4 py-3 text-[12px] text-muted ring-1 ring-line/70">
            Фото ваших работ «до/после». Появляются в блоке «Галерея» на странице записи.
          </div>
          <GalleryManager initialImages={galleryImages} galleryEnabled={galleryEnabled} />
        </TabsContent>

        <TabsContent value="qr">
          <div className="mb-3 rounded-xl bg-white px-4 py-3 text-[12px] text-muted ring-1 ring-line/70">
            QR-код ведёт на вашу страницу записи. Скачайте PNG и распечатайте — клиенту
            достаточно навести камеру телефона.
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
              <div className="flex items-center gap-1">
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
                  <Monitor size={14} /> Десктоп (100%)
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
            <div className="grid place-items-center rounded-3xl border border-line bg-paper/60 p-4 sm:p-6">
              <div
                className={`overflow-hidden rounded-[32px] border-4 border-ink/80 bg-white shadow-2xl transition-all duration-300 ${
                  previewDevice === "mobile"
                    ? "w-[375px] h-[720px]"
                    : previewDevice === "tablet"
                    ? "w-[768px] h-[800px]"
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
