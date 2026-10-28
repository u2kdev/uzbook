"use client";

import { useState } from "react";
import { useActionState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MapPin,
  MessageCircle,
  Palette,
  Settings2,
  ShieldAlert,
  Store,
  Phone,
  Send,
  Unlink,
} from "lucide-react";
import {
  updateProfileAction,
  unlinkTelegramAction,
  updateTelegramNotificationSettingsAction,
  type ProfileState,
} from "@/server/actions/profile";
import { slugify } from "@/lib/slug";

const CATEGORIES = [
  { id: "beauty", label: "Салон красоты" },
  { id: "barbershop", label: "Барбершоп" },
  { id: "dental", label: "Стоматология" },
  { id: "nails", label: "Ногтевой сервис" },
  { id: "massage", label: "Массаж и спа" },
  { id: "other", label: "Другое" },
];

type Settings = {
  slotStepMin: number;
  leadTimeMin: number;
  maxAdvanceDays: number;
  cancellationHours: number;
  autoConfirm: boolean;
  showPrices: boolean;
  requireEmail: boolean;
  telegramNotifications?: {
    newBooking?: boolean;
    cancelled?: boolean;
    rescheduled?: boolean;
    payment?: boolean;
    digest?: boolean;
  };
};

export type ProfileBusiness = {
  name: string;
  slug: string;
  category: string;
  tagline: string | null;
  description: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  instagram: string | null;
  website: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  accent: string;
  settings: Settings;
};

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[24px] bg-white p-5 ring-1 ring-line/80 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-paper text-ink-soft">
          <Icon size={17} strokeWidth={1.6} />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Toggle({
  name,
  defaultChecked,
  label,
  hint,
}: {
  name: string;
  defaultChecked: boolean;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-line/80 px-3.5 py-3 transition-colors hover:bg-paper/60">
      <span>
        <span className="block text-[13px] font-medium">{label}</span>
        <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted">{hint}</span>
      </span>
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 size-4 shrink-0 accent-[var(--color-brand)]"
      />
    </label>
  );
}

export function ProfileEditor({
  business,
  publicUrl,
  servicesCount,
  staffCount,
  telegram,
}: {
  business: ProfileBusiness;
  publicUrl: string;
  servicesCount: number;
  staffCount: number;
  telegram: {
    configured: boolean;
    link: string | null;
    connected?: boolean;
    telegramId?: string | null;
  };
}) {
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(
    updateProfileAction,
    null,
  );
  const [accent, setAccent] = useState(business.accent);
  const [name, setName] = useState(business.name);
  const [tagline, setTagline] = useState(business.tagline ?? "");
  const [unlinking, setUnlinking] = useState(false);
  const [notifSettings, setNotifSettings] = useState({
    newBooking: business.settings.telegramNotifications?.newBooking ?? true,
    cancelled: business.settings.telegramNotifications?.cancelled ?? true,
    rescheduled: business.settings.telegramNotifications?.rescheduled ?? true,
    payment: business.settings.telegramNotifications?.payment ?? true,
    digest: business.settings.telegramNotifications?.digest ?? false,
  });
  const [savingNotifs, setSavingNotifs] = useState(false);

  const handleToggleNotif = async (key: keyof typeof notifSettings) => {
    const next = { ...notifSettings, [key]: !notifSettings[key] };
    setNotifSettings(next);
    setSavingNotifs(true);
    try {
      await updateTelegramNotificationSettingsAction(next);
    } finally {
      setSavingNotifs(false);
    }
  };

  const handleUnlink = async () => {
    if (!confirm("Вы уверены, что хотите отвязать Telegram? Уведомления перестанут приходить.")) {
      return;
    }
    setUnlinking(true);
    try {
      await unlinkTelegramAction();
    } finally {
      setUnlinking(false);
    }
  };

  return (
    <form action={formAction} className="space-y-5 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">
            Мини-лендинг
          </p>
          <h1 className="mt-1.5 text-[26px] leading-tight font-semibold tracking-[-0.03em]">
            Страница вашего бизнеса
          </h1>
          <p className="mt-1 text-[12.5px] text-muted">
            {servicesCount} услуг · {staffCount} мастеров · ссылка для клиентов
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={publicUrl.replace(/^https?:\/\/[^/]+/, "")} target="_blank" className="btn btn-ghost h-10 text-[12.5px]">
            <ExternalLink size={14} strokeWidth={1.7} /> Посмотреть
          </Link>
          <button type="submit" disabled={pending} className="btn btn-primary h-10 text-[12.5px]">
            {pending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            Сохранить
          </button>
        </div>
      </div>

      {state?.error && (
        <div className="rounded-xl border border-rose/20 bg-rose/5 px-3.5 py-2.5 text-[12.5px] text-rose">
          {state.error}
        </div>
      )}
      {state?.ok && (
        <div className="rounded-xl border border-mint/20 bg-mint/5 px-3.5 py-2.5 text-[12.5px] text-mint">
          Изменения сохранены. Страница уже обновилась.
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-5">
          <SectionCard
            icon={Store}
            title="Основное"
            description="Имя, адрес страницы и короткое описание — это увидит клиент."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="label-base">
                  Название
                </label>
                <input
                  id="name"
                  name="name"
                  className="input-base"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="slug" className="label-base">
                  Адрес страницы
                </label>
                <div className="flex items-center overflow-hidden rounded-xl border border-line bg-white focus-within:border-brand/50 focus-within:ring-4 focus-within:ring-brand/10">
                  <span className="pl-3 text-[12px] text-muted select-none">/</span>
                  <input
                    id="slug"
                    name="slug"
                    defaultValue={business.slug}
                    className="h-[46px] min-w-0 flex-1 bg-transparent px-1.5 text-[13.5px] outline-none"
                    onInput={(event) => {
                      event.currentTarget.value = slugify(event.currentTarget.value);
                    }}
                    required
                  />
                </div>
                {state?.fieldErrors?.slug && (
                  <p className="mt-1.5 text-[12px] text-rose">{state.fieldErrors.slug}</p>
                )}
              </div>

              <div>
                <label htmlFor="category" className="label-base">
                  Тип бизнеса
                </label>
                <select
                  id="category"
                  name="category"
                  defaultValue={business.category}
                  className="input-base"
                >
                  {CATEGORIES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="tagline" className="label-base">
                  Короткая строка
                </label>
                <input
                  id="tagline"
                  name="tagline"
                  className="input-base"
                  placeholder="Салон красоты в центре Ташкента"
                  value={tagline}
                  onChange={(event) => setTagline(event.target.value)}
                  maxLength={120}
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="description" className="label-base">
                  О бизнесе
                </label>
                <textarea
                  id="description"
                  name="description"
                  defaultValue={business.description ?? ""}
                  rows={4}
                  maxLength={1200}
                  className="input-base h-auto resize-y py-3 leading-relaxed"
                  placeholder="2–3 предложения: чем вы отличаетесь, что важно знать клиенту."
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            icon={MapPin}
            title="Контакты"
            description="Появятся на странице записи и в напоминаниях."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="city" className="label-base">
                  Город
                </label>
                <input id="city" name="city" className="input-base" defaultValue={business.city ?? ""} />
              </div>
              <div>
                <label htmlFor="address" className="label-base">
                  Адрес
                </label>
                <input
                  id="address"
                  name="address"
                  className="input-base"
                  defaultValue={business.address ?? ""}
                  placeholder="ул. Шота Руставели, 12"
                />
              </div>
              <div>
                <label htmlFor="phone" className="label-base">
                  Телефон
                </label>
                <input
                  id="phone"
                  name="phone"
                  className="input-base"
                  defaultValue={business.phone ?? ""}
                  placeholder="+998 90 000 00 00"
                />
              </div>
              <div>
                <label htmlFor="instagram" className="label-base">
                  Instagram
                </label>
                <div className="flex items-center overflow-hidden rounded-xl border border-line bg-white focus-within:border-brand/50 focus-within:ring-4 focus-within:ring-brand/10">
                  <span className="pl-3 text-[13px] text-muted select-none">@</span>
                  <input
                    id="instagram"
                    name="instagram"
                    className="h-[46px] min-w-0 flex-1 bg-transparent px-1.5 text-[13.5px] outline-none"
                    defaultValue={business.instagram ?? ""}
                    placeholder="atelier.noir"
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="website" className="label-base">
                  Сайт <span className="font-normal normal-case text-muted">(необязательно)</span>
                </label>
                <input
                  id="website"
                  name="website"
                  className="input-base"
                  defaultValue={business.website ?? ""}
                  placeholder="https://"
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            icon={Palette}
            title="Оформление"
            description="Цвета, фон, шрифт, обложка и логотип — во вкладке «Дизайн»."
          >
            <p className="rounded-xl bg-brand-soft/50 px-4 py-3 text-[12px] leading-relaxed text-brand-dark">
              Откройте вкладку <b>«Дизайн»</b> выше: там готовые цвета, светлая/тёмная тема,
              шрифт и загрузка фона с логотипом. Здесь мы не дублируем эти поля, чтобы вы не
              запутались.
            </p>
          </SectionCard>

          <SectionCard
            icon={Settings2}
            title="Правила записи"
            description="Как считаются слоты и что происходит после брони."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="slotStepMin" className="label-base">
                  Шаг слотов
                </label>
                <select
                  id="slotStepMin"
                  name="slotStepMin"
                  defaultValue={business.settings.slotStepMin}
                  className="input-base"
                >
                  {[10, 15, 20, 30, 60].map((step) => (
                    <option key={step} value={step}>
                      Каждые {step} мин
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="leadTimeMin" className="label-base">
                  Минимум до записи
                </label>
                <select
                  id="leadTimeMin"
                  name="leadTimeMin"
                  defaultValue={business.settings.leadTimeMin}
                  className="input-base"
                >
                  {[0, 30, 60, 120, 240].map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes === 0 ? "Без ограничения" : `За ${minutes} мин`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="maxAdvanceDays" className="label-base">
                  Запись вперёд
                </label>
                <select
                  id="maxAdvanceDays"
                  name="maxAdvanceDays"
                  defaultValue={business.settings.maxAdvanceDays}
                  className="input-base"
                >
                  {[14, 30, 60, 90, 180].map((days) => (
                    <option key={days} value={days}>
                      На {days} дней
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="cancellationHours" className="label-base">
                  Отмена не позже чем
                </label>
                <select
                  id="cancellationHours"
                  name="cancellationHours"
                  defaultValue={business.settings.cancellationHours}
                  className="input-base"
                >
                  {[0, 1, 2, 3, 6, 12, 24].map((hours) => (
                    <option key={hours} value={hours}>
                      {hours === 0 ? "В любой момент" : `За ${hours} ч`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <Toggle
                name="autoConfirm"
                defaultChecked={business.settings.autoConfirm}
                label="Подтверждать автоматически"
                hint="Запись сразу попадает в таймлайн. Иначе будет ждать подтверждения."
              />
              <Toggle
                name="showPrices"
                defaultChecked={business.settings.showPrices}
                label="Показывать цены"
                hint="Клиент увидит стоимость услуги на странице записи."
              />
              <Toggle
                name="requireEmail"
                defaultChecked={business.settings.requireEmail}
                label="Спрашивать email"
                hint="Полезно для чеков и напоминаний на почту."
              />
            </div>
          </SectionCard>
        </div>

        <div className="space-y-5">
          {/* Live preview */}
          <div className="overflow-hidden rounded-[24px] bg-white ring-1 ring-line/80">
            <div
              className="h-24 w-full"
              style={{
                background: `radial-gradient(120% 140% at 0% 0%, ${accent}38, transparent 60%), radial-gradient(90% 120% at 100% 0%, #12b88622, transparent 60%), #f6f6fa`,
              }}
            />
            <div className="px-5 pb-5">
              <div
                className="-mt-7 grid size-14 place-items-center rounded-2xl text-[18px] font-semibold text-white ring-4 ring-white"
                style={{ background: accent }}
              >
                {name.slice(0, 1).toUpperCase() || "U"}
              </div>
              <p className="mt-3 text-[15px] font-semibold">{name || "Название бизнеса"}</p>
              <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-muted">
                {tagline || "Короткое описание, которое увидит клиент."}
              </p>
              <div className="mt-4 rounded-xl bg-paper px-3 py-2.5">
                <p className="text-[10px] font-semibold tracking-[0.14em] text-muted uppercase">
                  Ссылка для записи
                </p>
                <p className="mt-1 truncate text-[11.5px] font-medium">{publicUrl}</p>
              </div>
              <span
                className="mt-4 flex h-10 items-center justify-center rounded-full text-[12.5px] font-semibold text-white"
                style={{ background: accent }}
              >
                Записаться
              </span>
            </div>
          </div>

          {/* Telegram */}
          <div className="rounded-[24px] bg-white p-5 ring-1 ring-line/80">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-[#e8f3fd] text-[#229ed9]">
                <Send size={17} strokeWidth={1.7} />
              </span>
              <div>
                <p className="text-[13.5px] font-semibold">Telegram-уведомления</p>
                <p className="text-[11px] text-muted">Новые записи, отмены и напоминания</p>
              </div>
            </div>

            {telegram.connected ? (
              <div className="mt-4 space-y-3.5">
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3.5 py-2.5 border border-emerald-200">
                  <div className="flex items-center gap-2 text-emerald-800 text-[12px] font-medium">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>Подключен {telegram.telegramId ? `(ID: ${telegram.telegramId})` : ""}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleUnlink}
                    disabled={unlinking}
                    className="flex items-center gap-1 text-[11px] font-medium text-rose hover:underline"
                  >
                    {unlinking ? <Loader2 size={12} className="animate-spin" /> : <Unlink size={12} />}
                    Отвязать
                  </button>
                </div>

                <div className="pt-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2">
                    Типы уведомлений {savingNotifs && <Loader2 size={10} className="inline ml-1 animate-spin" />}
                  </p>
                  <div className="space-y-1.5 text-[12px]">
                    <label className="flex items-center justify-between cursor-pointer rounded-lg px-2.5 py-1.5 hover:bg-paper">
                      <span>🔔 Новые записи</span>
                      <input
                        type="checkbox"
                        checked={notifSettings.newBooking}
                        onChange={() => handleToggleNotif("newBooking")}
                        className="size-4 accent-[var(--color-brand)]"
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer rounded-lg px-2.5 py-1.5 hover:bg-paper">
                      <span>🔄 Отмены и переносы</span>
                      <input
                        type="checkbox"
                        checked={notifSettings.cancelled && notifSettings.rescheduled}
                        onChange={() => {
                          const nextVal = !(notifSettings.cancelled && notifSettings.rescheduled);
                          const next = { ...notifSettings, cancelled: nextVal, rescheduled: nextVal };
                          setNotifSettings(next);
                          setSavingNotifs(true);
                          updateTelegramNotificationSettingsAction(next).finally(() => setSavingNotifs(false));
                        }}
                        className="size-4 accent-[var(--color-brand)]"
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer rounded-lg px-2.5 py-1.5 hover:bg-paper">
                      <span>💳 Оплаты и подписка</span>
                      <input
                        type="checkbox"
                        checked={notifSettings.payment}
                        onChange={() => handleToggleNotif("payment")}
                        className="size-4 accent-[var(--color-brand)]"
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer rounded-lg px-2.5 py-1.5 hover:bg-paper">
                      <span>📊 Утренний дайджест</span>
                      <input
                        type="checkbox"
                        checked={notifSettings.digest}
                        onChange={() => handleToggleNotif("digest")}
                        className="size-4 accent-[var(--color-brand)]"
                      />
                    </label>
                  </div>
                </div>
              </div>
            ) : telegram.configured ? (
              telegram.link ? (
                <>
                  <p className="mt-3.5 text-[12px] leading-relaxed text-muted">
                    Привяжите Telegram — и бот будет присылать записи, отмены и переносы. Ссылка
                    действует 7 дней.
                  </p>
                  <Link
                    href={telegram.link}
                    target="_blank"
                    className="btn btn-ghost mt-3.5 h-10 w-full text-[12px]"
                  >
                    <MessageCircle size={14} strokeWidth={1.7} />
                    Подключить Telegram
                    <ArrowUpRight size={13} strokeWidth={1.7} />
                  </Link>
                </>
              ) : (
                <p className="mt-3.5 text-[12px] leading-relaxed text-muted">
                  Бот настроен, но не указан <code className="text-ink">TELEGRAM_BOT_USERNAME</code>{" "}
                  в .env — ссылка появится после перезапуска.
                </p>
              )
            ) : (
              <p className="mt-3.5 text-[12px] leading-relaxed text-muted">
                Чтобы включить, запустите бота и добавьте в <code className="text-ink">.env</code>{" "}
                <code className="text-ink">TELEGRAM_BOT_TOKEN</code> и{" "}
                <code className="text-ink">TELEGRAM_BOT_USERNAME</code>.
              </p>
            )}
          </div>

          <div className="rounded-[24px] border border-line/80 bg-paper/60 p-5">
            <p className="text-[12px] font-semibold">Клиент не регистрируется</p>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
              После записи он получает ссылку на управление: перенести или отменить можно без
              логина. Ссылка приходит на страницу после брони и в Telegram владельцу.
            </p>
            <Link
              href="/dashboard/bookings"
              className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-brand-dark"
            >
              Проверить в записях <ArrowUpRight size={13} strokeWidth={1.8} />
            </Link>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/90 px-4 py-3 backdrop-blur-xl lg:left-[248px]">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-3">
          <p className="hidden text-[11.5px] text-muted sm:block">
            {state?.ok ? "Сохранено · страница обновлена" : "Изменения применяются сразу после сохранения"}
          </p>
          <div className="flex items-center gap-2">
            <Link href={publicUrl.replace(/^https?:\/\/[^/]+/, "")} target="_blank" className="btn btn-ghost h-10 text-[12px]">
              <ExternalLink size={14} /> Открыть
            </Link>
            <button type="submit" disabled={pending} className="btn btn-primary h-10 text-[12.5px]">
              {pending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              Сохранить изменения
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
