"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Clock3, Globe, Instagram, MapPin, Phone, Scissors, Sparkles } from "lucide-react";
import { BookingWizard, type WizardService, type WizardStaff } from "./booking-wizard";
import { formatMoney } from "@/lib/plans";

export type PublicPageSection = {
  id: string;
  type: string;
  config: Record<string, unknown>;
  sortOrder: number;
};

export type PublicGalleryImage = {
  id: string;
  url: string;
  beforeUrl: string | null;
  caption: string | null;
};

export type SalonData = {
  business: {
    name: string;
    slug: string;
    category: string;
    tagline: string | null;
    description: string | null;
    logoUrl: string | null;
    coverUrl: string | null;
    address: string | null;
    city: string | null;
    phone: string | null;
    instagram: string | null;
    website: string | null;
    timezone: string;
    currency: string;
    accent: string;
    mode: "light" | "dark";
    fontPair: number;
    showPrices: boolean;
  };
  services: WizardService[];
  staff: (WizardStaff & {
    bio: string | null;
    nextSlots: { date: string; slots: { start: string; label: string }[] } | null;
  })[];
  pageSections: PublicPageSection[];
  gallery: PublicGalleryImage[];
};

function durationLabel(minutes: number) {
  if (minutes < 60) return `${minutes} мин`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

function dayWord(dateStr: string, timezone: string) {
  if (!dateStr) return "";
  const parsed = new Date(`${dateStr}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
  const tomorrow = (() => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  })();
  if (dateStr === today) return "сегодня";
  if (dateStr === tomorrow) return "завтра";
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: timezone,
    day: "numeric",
    month: "long",
  }).format(parsed);
}

function formatDateFull(dateStr: string, timezone: string) {
  if (!dateStr) return "";
  const parsed = new Date(`${dateStr}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(parsed);
}

const CATEGORY_LABEL: Record<string, string> = {
  beauty: "Салон красоты",
  barbershop: "Барбершоп",
  dental: "Стоматология",
  nails: "Ногтевой сервис",
  massage: "Массаж и спа",
  other: "Услуги",
};

function RenderHero({ business, nearest, openBooking, staff, serif }: {
  business: SalonData["business"];
  nearest: { date: string; label: string } | null;
  openBooking: (staffId?: string) => void;
  staff: SalonData["staff"];
  serif: boolean;
}) {
  return (
    <section className="px-5 pt-10 pb-8 sm:pt-14">
      <div className="grid items-end gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/[0.04] px-2.5 py-1 text-[10px] font-medium tracking-[0.14em] uppercase">
            <span className="size-1.5 rounded-full" style={{ background: business.accent }} />
            {CATEGORY_LABEL[business.category] ?? "Запись онлайн"}
          </span>

          <h1
            className={`mt-5 text-[clamp(2.6rem,7vw,4.4rem)] leading-[0.98] font-semibold tracking-[-0.04em] ${
              serif ? "font-serif font-medium" : ""
            }`}
          >
            {business.name}
          </h1>

          {business.tagline && (
            <p className="mt-3 max-w-md text-[15.5px] leading-relaxed text-ink/60">
              {business.tagline}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-ink/55">
            {business.city && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={13} strokeWidth={1.7} /> {business.city}
              </span>
            )}
            {business.address && (
              <span className="inline-flex items-center gap-1.5">
                {business.address}
              </span>
            )}
            {nearest && (
              <span className="inline-flex items-center gap-1.5">
                <Clock3 size={13} strokeWidth={1.7} />
                Ближайшее окно: {dayWord(nearest.date, business.timezone)} в {nearest.label}
              </span>
            )}
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              onClick={() => openBooking()}
              className="btn group h-12 px-3 pl-6 text-white shadow-[0_18px_40px_-20px_rgba(0,0,0,0.5)]"
              style={{ background: business.accent }}
            >
              Записаться онлайн
              <span className="grid size-8 place-items-center rounded-full bg-white/20 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-1 group-hover:-translate-y-px">
                <ArrowUpRight size={16} strokeWidth={1.7} />
              </span>
            </button>
            {business.phone && (
              <a
                href={`tel:${business.phone.replace(/\s/g, "")}`}
                className="btn btn-ghost h-12 border-line bg-white/60 text-[13px] hover:bg-white"
              >
                <Phone size={15} strokeWidth={1.6} /> Позвонить
              </a>
            )}
          </div>
        </div>

        <div className="relative hidden lg:block">
          <div className="absolute -inset-6 rounded-[36px] bg-[radial-gradient(60%_60%_at_70%_20%,var(--accent),transparent_70%)] opacity-[0.13]" />
          <div className="relative overflow-hidden rounded-[28px] border border-line bg-white p-5 shadow-[0_30px_80px_-50px_rgba(0,0,0,0.5)]">
            <p className="text-[10px] font-semibold tracking-[0.16em] text-muted uppercase">
              Свободно на неделю
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {staff.slice(0, 4).map((member) => (
                <button
                  key={member.id}
                  onClick={() => openBooking(member.id)}
                  className="flex items-center gap-2.5 rounded-xl border border-line/70 bg-paper p-2.5 text-left transition-colors hover:bg-white"
                >
                  <span
                    className="grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white"
                    style={{ background: member.color }}
                  >
                    {member.name.slice(0, 1)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[11.5px] font-semibold">{member.name}</p>
                    <p className="truncate text-[10px] text-muted">
                      {member.nextSlots
                        ? `${dayWord(member.nextSlots.date, business.timezone)}, ${member.nextSlots.slots[0]?.label}`
                        : "нет окон"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[10.5px] text-muted">
              <span>{staff.length} мастеров</span>
              <span className="inline-flex items-center gap-1">
                <Sparkles size={11} /> без звонков
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function RenderDescription({ business }: { business: SalonData["business"] }) {
  if (!business.description) return null;
  return (
    <section className="px-5 py-6">
      <div className="max-w-2xl border-l-2 pl-5" style={{ borderColor: business.accent }}>
        <p className="text-[14.5px] leading-[1.75] text-ink/70">{business.description}</p>
      </div>
    </section>
  );
}

function RenderStaff({ business, staff, openBooking, serif }: {
  business: SalonData["business"];
  staff: SalonData["staff"];
  openBooking: (staffId?: string) => void;
  serif: boolean;
}) {
  return (
    <section className="px-5 py-10">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.18em] text-muted uppercase">
            Команда
          </p>
          <h2 className={`mt-2 text-[26px] font-semibold tracking-[-0.03em] ${serif ? "font-serif font-medium" : ""}`}>
            Мастера
          </h2>
        </div>
        <p className="hidden text-[11.5px] text-muted sm:block">
          Нажмите на мастера, чтобы увидеть свободное время
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {staff.map((member) => (
          <button
            key={member.id}
            onClick={() => openBooking(member.id)}
            className="group rounded-[22px] border border-black/[0.06] bg-white p-5 text-left transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1 hover:shadow-[0_30px_60px_-40px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-center gap-3">
              <span
                className="grid size-11 place-items-center overflow-hidden rounded-full text-[14px] font-semibold text-white"
                style={{ background: member.color }}
              >
                {member.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={member.photoUrl} alt={member.name} className="size-full object-cover" />
                ) : (
                  member.name.slice(0, 1)
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold">{member.name}</p>
                <p className="truncate text-[11.5px] text-muted">{member.title || "Мастер"}</p>
              </div>
              <ArrowUpRight
                size={15}
                className="ml-auto text-muted transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </div>

            {member.bio && (
              <p className="mt-3 line-clamp-2 text-[11.5px] leading-relaxed text-ink/50">
                {member.bio}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-1.5">
              {member.nextSlots ? (
                <>
                  <span className="text-[10.5px] text-muted">
                    {dayWord(member.nextSlots.date, business.timezone)}:
                  </span>
                  {member.nextSlots.slots.slice(0, 3).map((slot) => (
                    <span
                      key={slot.start}
                      className="rounded-md px-1.5 py-0.5 text-[10.5px] font-medium"
                      style={{
                        background: `${business.accent}12`,
                        color: business.accent,
                      }}
                    >
                      {slot.label}
                    </span>
                  ))}
                </>
              ) : (
                <span className="text-[10.5px] text-muted">Ближайшее время уточняйте</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function RenderServices({ business, services, staff, openBooking, categories, serif }: {
  business: SalonData["business"];
  services: WizardService[];
  staff: SalonData["staff"];
  openBooking: (staffId?: string) => void;
  categories: string[];
  serif: boolean;
}) {
  return (
    <section className="px-5 py-10">
      <p className="text-[10px] font-semibold tracking-[0.18em] text-muted uppercase">Прайс</p>
      <h2 className={`mt-2 text-[26px] font-semibold tracking-[-0.03em] ${serif ? "font-serif font-medium" : ""}`}>
        Услуги
      </h2>

      <div className="mt-6 space-y-8">
        {categories.map((category) => (
          <div key={category}>
            <p className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-muted/80 uppercase">
              {category}
            </p>
            <div className="overflow-hidden rounded-[20px] border border-black/[0.06] bg-white">
              {services
                .filter((service) => (service.category?.trim() || "Услуги") === category)
                .map((service, index) => (
                  <button
                    key={service.id}
                    onClick={() => openBooking()}
                    className={`flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-[#fcfbfa] ${
                      index > 0 ? "border-t border-black/[0.05]" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium">{service.name}</p>
                      {service.description && (
                        <p className="mt-0.5 line-clamp-1 text-[11.5px] text-muted">
                          {service.description}
                        </p>
                      )}
                    </div>
                    <span className="hidden items-center gap-1 text-[11px] text-muted sm:flex">
                      <Clock3 size={12} strokeWidth={1.6} />
                      {durationLabel(service.durationMin)}
                    </span>
                    {business.showPrices && (
                      <span className="text-[13px] font-semibold tabular-nums">
                        {formatMoney(service.price, business.currency)}
                      </span>
                    )}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RenderContacts({ business }: { business: SalonData["business"] }) {
  const hasContacts = business.address || business.phone || business.instagram;
  if (!hasContacts) return null;
  return (
    <section className="px-5 py-10">
      <div className="grid gap-3 sm:grid-cols-3">
        {business.address && (
          <div className="rounded-2xl border border-black/[0.06] bg-white p-4">
            <MapPin size={16} strokeWidth={1.6} className="text-muted" />
            <p className="mt-2.5 text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
              Адрес
            </p>
            <p className="mt-1 text-[13px] font-medium">{business.address}</p>
            {business.city && <p className="text-[11.5px] text-muted">{business.city}</p>}
          </div>
        )}
        {business.phone && (
          <a
            href={`tel:${business.phone.replace(/\s/g, "")}`}
            className="rounded-2xl border border-black/[0.06] bg-white p-4 transition-colors hover:bg-[#fcfbfa]"
          >
            <Phone size={16} strokeWidth={1.6} className="text-muted" />
            <p className="mt-2.5 text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
              Телефон
            </p>
            <p className="mt-1 text-[13px] font-medium">{business.phone}</p>
          </a>
        )}
        {business.instagram && (
          <a
            href={`https://instagram.com/${business.instagram.replace("@", "")}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-black/[0.06] bg-white p-4 transition-colors hover:bg-[#fcfbfa]"
          >
            <Instagram size={16} strokeWidth={1.6} className="text-muted" />
            <p className="mt-2.5 text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
              Instagram
            </p>
            <p className="mt-1 text-[13px] font-medium">@{business.instagram.replace("@", "")}</p>
          </a>
        )}
        {business.website && (
          <a
            href={business.website.startsWith("http") ? business.website : `https://${business.website}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-black/[0.06] bg-white p-4 transition-colors hover:bg-[#fcfbfa]"
          >
            <Globe size={16} strokeWidth={1.6} className="text-muted" />
            <p className="mt-2.5 text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
              Сайт
            </p>
            <p className="mt-1 truncate text-[13px] font-medium">{business.website.replace(/^https?:\/\//, "")}</p>
          </a>
        )}
      </div>
    </section>
  );
}

function RenderReviews({ section }: { section: PublicPageSection }) {
  const config = section.config as { title?: string; subtitle?: string; items?: Array<{ name: string; avatar: string | null; rating: number; text: string; date: string }> };
  const items = config.items ?? [];
  if (items.length === 0) return null;

  return (
    <section className="px-5 py-10">
      <div className="mb-6">
        <p className="text-[10px] font-semibold tracking-[0.18em] text-muted uppercase">
          {config.title ?? "Отзывы"}
        </p>
        {config.subtitle && (
          <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.03em]">
            {config.subtitle}
          </h2>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => (
          <div key={index} className="rounded-[20px] border border-black/[0.06] bg-white p-5">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={i}
                  className={`size-4 ${i < item.rating ? "text-amber" : "text-muted/30"}`}
                >
                  ★
                </span>
              ))}
            </div>
            <p className="mt-3 text-[13.5px] leading-relaxed text-ink/80">"{item.text}"</p>
            <div className="mt-4 flex items-center gap-2 text-[11.5px] text-muted">
              <span className="font-medium">{item.name}</span>
              {item.date && (
                <>
                  <span>·</span>
                  <span>{formatDateFull(item.date, "Asia/Tashkent")}</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RenderPromotions({ section, business }: { section: PublicPageSection; business: SalonData["business"] }) {
  const config = section.config as { title?: string; subtitle?: string; items?: Array<{ title: string; description: string; validUntil: string; serviceCategory?: string }> };
  const items = config.items ?? [];
  if (items.length === 0) return null;

  const accentStyle = { ["--accent" as string]: business.accent } as React.CSSProperties;

  return (
    <section className="px-5 py-10" style={accentStyle}>
      <div className="mb-6">
        <p className="text-[10px] font-semibold tracking-[0.18em] text-muted uppercase">
          {config.title ?? "Акции"}
        </p>
        {config.subtitle && (
          <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.03em]">
            {config.subtitle}
          </h2>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item, index) => (
          <div
            key={index}
            className="relative rounded-[20px] border border-black/[0.06] bg-white p-5 overflow-hidden"
            style={{ borderColor: `${business.accent}40` }}
          >
            <div className="absolute top-0 right-0 h-full w-[120px] opacity-5" style={{ background: `linear-gradient(135deg, ${business.accent}, transparent)` }} />
            <p className="relative text-[13.5px] font-semibold">{item.title}</p>
            <p className="mt-1.5 relative text-[12.5px] leading-relaxed text-ink/70">{item.description}</p>
            {item.validUntil && (
              <p className="mt-3 relative text-[11px] text-muted">
                Действует до {dayWord(item.validUntil, business.timezone)}
              </p>
            )}
            {item.serviceCategory && (
              <span className="mt-3 inline-block relative rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: `${business.accent}15`, color: business.accent }}>
                {item.serviceCategory}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function RenderFAQ({ section }: { section: PublicPageSection }) {
  const config = section.config as { title?: string; items?: Array<{ question: string; answer: string }> };
  const items = config.items ?? [];
  if (items.length === 0) return null;

  return (
    <section className="px-5 py-10">
      <p className="text-[10px] font-semibold tracking-[0.18em] text-muted uppercase">
        {config.title ?? "Частые вопросы"}
      </p>
      <div className="mt-6 space-y-3">
        {items.map((item, index) => (
          <details key={index} className="group rounded-[16px] border border-line bg-white">
            <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none text-[13.5px] font-medium">
              {item.question}
              <span className="shrink-0 text-muted transition-transform group-open:rotate-180">
                ▼
              </span>
            </summary>
            <div className="px-5 pb-4 pt-0 border-t border-line/60">
              <p className="text-[12.5px] leading-relaxed text-ink/70">{item.answer}</p>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function RenderGallery({
  section,
  images,
}: {
  section: PublicPageSection;
  images: PublicGalleryImage[];
}) {
  const config = section.config as {
    title?: string;
    subtitle?: string;
    items?: Array<{ before?: string; after: string; caption?: string }>;
  };
  const items = [
    ...(config.items ?? []).map((item) => ({
      before: item.before ?? null,
      after: item.after,
      caption: item.caption ?? null,
    })),
    ...images.map((image) => ({
      before: image.beforeUrl,
      after: image.url,
      caption: image.caption,
    })),
  ].filter((item) => Boolean(item.after));

  if (items.length === 0) return null;

  return (
    <section className="px-5 py-10">
      <div className="mb-6">
        <p className="text-[10px] font-semibold tracking-[0.18em] text-muted uppercase">
          {config.title ?? "Наши работы"}
        </p>
        {config.subtitle && (
          <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.03em]">
            {config.subtitle}
          </h2>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => (
          <figure
            key={index}
            className="group overflow-hidden rounded-[20px] border border-line bg-white"
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-paper">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.after}
                alt={item.caption ?? "Работа"}
                loading="lazy"
                className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
              {item.before && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.before}
                  alt="До"
                  loading="lazy"
                  className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />
              )}
              {item.before && (
                <span className="absolute top-3 left-3 rounded-full bg-white/90 px-2 py-0.5 text-[9.5px] font-semibold text-ink opacity-100 transition-opacity group-hover:opacity-0">
                  до / после
                </span>
              )}
            </div>
            {item.caption && (
              <figcaption className="px-4 py-3 text-[12px] text-ink-soft">
                {item.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </section>
  );
}

function RenderVacancies({ section }: { section: PublicPageSection }) {
  const config = section.config as { title?: string; items?: Array<{ title: string; description: string; requirements: string }> };
  const items = config.items ?? [];
  if (items.length === 0) return null;

  return (
    <section className="px-5 py-10">
      <p className="text-[10px] font-semibold tracking-[0.18em] text-muted uppercase">
        {config.title ?? "Вакансии"}
      </p>
      <div className="mt-6 space-y-4">
        {items.map((item, index) => (
          <div key={index} className="rounded-[20px] border border-line bg-white p-5">
            <p className="text-[13.5px] font-semibold">{item.title}</p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink/70">{item.description}</p>
            {item.requirements && (
              <p className="mt-2 text-[11.5px] text-muted">Требования: {item.requirements}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function RenderCustomHTML({ section }: { section: PublicPageSection }) {
  const config = section.config as { html?: string };
  if (!config.html) return null;

  return (
    <section className="px-5 py-10" dangerouslySetInnerHTML={{ __html: config.html }} />
  );
}

function RenderSection({ section, business, services, staff, openBooking, categories, nearest, serif, gallery }: {
  section: PublicPageSection;
  business: SalonData["business"];
  services: WizardService[];
  staff: SalonData["staff"];
  openBooking: (staffId?: string) => void;
  categories: string[];
  nearest: { date: string; label: string } | null;
  serif: boolean;
  gallery: PublicGalleryImage[];
}) {
  switch (section.type) {
    case "hero":
      return <RenderHero business={business} nearest={nearest} openBooking={openBooking} staff={staff} serif={serif} />;
    case "staff":
      return <RenderStaff business={business} staff={staff} openBooking={openBooking} serif={serif} />;
    case "services":
      return <RenderServices business={business} services={services} staff={staff} openBooking={openBooking} categories={categories} serif={serif} />;
    case "contacts":
      return <RenderContacts business={business} />;
    case "reviews":
      return <RenderReviews section={section} />;
    case "promotions":
      return <RenderPromotions section={section} business={business} />;
    case "faq":
      return <RenderFAQ section={section} />;
    case "gallery":
      return <RenderGallery section={section} images={gallery} />;
    case "vacancies":
      return <RenderVacancies section={section} />;
    case "custom_html":
      return <RenderCustomHTML section={section} />;
    default:
      return null;
  }
}

export function SalonPage({ data }: { data: SalonData }) {
  const { business, services, staff, pageSections, gallery } = data;
  const [wizardOpen, setWizardOpen] = useState(false);
  const [presetStaff, setPresetStaff] = useState<string | null>(null);

  const categories = [...new Set(services.map((s) => s.category?.trim() || "Услуги"))];
  const autoSerif = ["beauty", "massage", "dental"].includes(business.category);
  const serif =
    business.fontPair === 2 ? true : business.fontPair === 1 ? false : autoSerif;
  const dark = business.mode === "dark";

  function openBooking(staffId?: string) {
    setPresetStaff(staffId ?? null);
    setWizardOpen(true);
  }

  const nearest = staff
    .flatMap((member) => (member.nextSlots?.slots ?? []).map((slot) => ({ ...slot, date: member.nextSlots!.date })))
    .sort((a, b) => a.start.localeCompare(b.start))[0];

  return (
    <div
      className={`min-h-dvh bg-paper pb-24 text-ink sm:pb-0 ${dark ? "theme-dark" : ""}`}
      style={{ ["--accent" as string]: business.accent }}
    >
      <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <span
              className="grid size-9 place-items-center overflow-hidden rounded-full text-[13px] font-semibold text-white"
              style={{ background: business.accent }}
            >
              {business.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={business.logoUrl} alt={business.name} className="size-full object-cover" />
              ) : (
                business.name.slice(0, 1)
              )}
            </span>
            <div>
              <p className="text-[13.5px] leading-tight font-semibold">{business.name}</p>
              <p className="text-[10.5px] text-muted">
                {CATEGORY_LABEL[business.category] ?? "Запись онлайн"}
              </p>
            </div>
          </div>

          <button
            onClick={() => openBooking()}
            className="btn h-9 px-4 text-[12.5px] text-white transition-transform duration-300 active:scale-[0.98]"
            style={{ background: business.accent }}
          >
            Записаться
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl">
        {business.coverUrl && (
          <div className="px-5 pt-5">
            <div className="overflow-hidden rounded-[24px] ring-1 ring-line/60">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={business.coverUrl}
                alt={business.name}
                className="aspect-[3/1] w-full object-cover"
              />
            </div>
          </div>
        )}

        {pageSections.length > 0 ? (
          pageSections.map((section) => (
            <RenderSection
              key={section.id}
              section={section}
              business={business}
              services={services}
              staff={staff}
              openBooking={openBooking}
              categories={categories}
              nearest={nearest}
              serif={serif}
              gallery={gallery}
            />
          ))
        ) : (
          <>
            <RenderHero business={business} nearest={nearest} openBooking={openBooking} staff={staff} serif={serif} />
            <RenderDescription business={business} />
            <RenderStaff business={business} staff={staff} openBooking={openBooking} serif={serif} />
            <RenderServices business={business} services={services} staff={staff} openBooking={openBooking} categories={categories} serif={serif} />
            <RenderContacts business={business} />
          </>
        )}
      </main>

      <footer className="border-t border-line px-5 py-6">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 text-[11px] text-muted">
          <span>© {new Date().getFullYear()} {business.name}</span>
          <Link href="/" className="inline-flex items-center gap-1.5 hover:text-ink">
            <Scissors size={11} strokeWidth={1.6} /> Работает на uzbook
          </Link>
        </div>
      </footer>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 p-3 backdrop-blur-xl sm:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] text-muted">
              {nearest ? `Ближайшее: ${dayWord(nearest.date, business.timezone)} в ${nearest.label}` : "Запись онлайн"}
            </p>
            <p className="text-[12.5px] font-semibold">Записаться без звонков</p>
          </div>
          <button
            onClick={() => openBooking()}
            className="btn h-11 shrink-0 px-5 text-white"
            style={{ background: business.accent }}
          >
            Записаться
          </button>
        </div>
      </div>

      <BookingWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        slug={business.slug}
        businessName={business.name}
        phone={business.phone}
        address={business.address}
        timezone={business.timezone}
        currency={business.currency}
        accent={business.accent}
        services={services}
        staff={staff}
        initialStaffId={presetStaff}
      />
    </div>
  );
}
