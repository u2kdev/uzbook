import React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Headphones,
  Mail,
  MapPin,
  MessageCircle,
  Scissors,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Logo } from "@/components/logo";

export function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-line/80 bg-white/60 backdrop-blur-md">
      <div className="container-page py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-5">
          {/* Brand & Overview (Spans 2 columns) */}
          <div className="space-y-5 lg:col-span-2">
            <Logo />
            <p className="max-w-sm text-[14px] leading-relaxed text-muted">
              Платформа онлайн-записи и автоматизации сферы услуг в Узбекистане.
              Создайте собственную персонализированную страницу за 2 минуты,
              принимайте записи без звонков и переписок 24/7.
            </p>

            <div className="flex flex-col gap-2.5 pt-1 text-[13px] text-ink-soft">
              <div className="flex items-center gap-2">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                <span className="font-medium text-emerald-600">
                  uzbook.online работает стабильно
                </span>
              </div>
              <div className="flex items-center gap-2 text-muted">
                <MapPin size={14} className="text-muted" />
                <span>Ташкент, Узбекистан</span>
              </div>
            </div>
          </div>

          {/* Column: Продукт */}
          <div className="space-y-4">
            <h3 className="text-[13px] font-bold tracking-wider text-ink uppercase">
              Продукт
            </h3>
            <ul className="space-y-2.5 text-[13.5px] text-muted">
              <li>
                <a href="#features" className="transition-colors hover:text-ink">
                  Возможности платформы
                </a>
              </li>
              <li>
                <a href="#how" className="transition-colors hover:text-ink">
                  Как это работает
                </a>
              </li>
              <li>
                <a href="#pricing" className="transition-colors hover:text-ink">
                  Тарифы и скидки
                </a>
              </li>
              <li>
                <Link
                  href="/atelier-noir"
                  className="inline-flex items-center gap-1 text-ink-soft transition-colors hover:text-brand"
                >
                  <span>Демо-страница</span>
                  <ArrowUpRight size={13} />
                </Link>
              </li>
              <li>
                <Link href="/register" className="transition-colors hover:text-ink">
                  Создать страницу
                </Link>
              </li>
            </ul>
          </div>

          {/* Column: Для бизнеса */}
          <div className="space-y-4">
            <h3 className="text-[13px] font-bold tracking-wider text-ink uppercase">
              Для кого
            </h3>
            <ul className="space-y-2.5 text-[13.5px] text-muted">
              <li>
                <span className="transition-colors hover:text-ink">
                  Салоны красоты
                </span>
              </li>
              <li>
                <span className="transition-colors hover:text-ink">
                  Барбершопы
                </span>
              </li>
              <li>
                <span className="transition-colors hover:text-ink">
                  Стоматологии и клиники
                </span>
              </li>
              <li>
                <span className="transition-colors hover:text-ink">
                  Мастера маникюра и бровей
                </span>
              </li>
              <li>
                <span className="transition-colors hover:text-ink">
                  Массаж и СПА
                </span>
              </li>
              <li>
                <span className="transition-colors hover:text-ink">
                  Частные специалисты
                </span>
              </li>
            </ul>
          </div>

          {/* Column: Партнёрам и контакты */}
          <div className="space-y-4">
            <h3 className="text-[13px] font-bold tracking-wider text-ink uppercase">
              Партнёрам
            </h3>
            <ul className="space-y-2.5 text-[13.5px] text-muted">
              <li>
                <Link
                  href="/become-provider"
                  className="font-semibold text-brand transition-colors hover:text-brand-dark hover:underline"
                >
                  Стать провайдером
                </Link>
              </li>
              <li>
                <Link href="/login" className="transition-colors hover:text-ink">
                  Вход в личный кабинет
                </Link>
              </li>
              <li>
                <a
                  href="mailto:support@uzbook.online"
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-ink"
                >
                  <Mail size={14} />
                  <span>support@uzbook.online</span>
                </a>
              </li>
              <li>
                <a
                  href="https://t.me/uzbook_online"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-medium text-brand transition-colors hover:text-brand-dark"
                >
                  <MessageCircle size={14} />
                  <span>Поддержка в Telegram</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright and legal line */}
        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-line/60 pt-8 text-[12.5px] text-muted sm:flex-row">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>© {currentYear} uzbook.online. Все права защищены.</span>
            <span className="hidden text-line sm:inline">|</span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-mint" />
              <span>Защищённое соединение SSL</span>
            </span>
          </div>

          <div className="flex items-center gap-6">
            <span className="inline-flex items-center gap-1 text-ink-soft">
              <Scissors size={13} strokeWidth={1.8} className="text-brand" />
              <span>Создано для мастеров и салонов Узбекистана</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
