"use client";

import { useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Images,
  LayoutGrid,
  Palette,
  QrCode,
  Store,
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
  const enabledSections = sections.filter((section) => section.enabled).length;
  const galleryEnabled = sections.some((section) => section.type === "gallery" && section.enabled);

  return (
    <div className="space-y-5">
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

      <div className="rounded-[20px] border border-brand/15 bg-brand-soft/40 px-4 py-3 text-[12px] leading-relaxed text-ink-soft">
        <b>С чего начать:</b> заполните «Основное» → соберите «Блоки» → выберите цвета в
        «Дизайне» → добавьте фото в «Галерею» → распечатайте QR-код. Изменения сохраняются
        кнопкой в каждом разделе и сразу видны на странице.
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
      </Tabs>
    </div>
  );
}
