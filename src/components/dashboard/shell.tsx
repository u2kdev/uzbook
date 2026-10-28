"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CreditCard,
  LayoutGrid,
  LogOut,
  Menu,
  Scissors,
  Users,
  UserCheck,
  Contact2,
  X,
  Building2,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { logoutAction } from "@/app/(auth)/actions";

const NAV = [
  {
    label: "Работа",
    items: [
      { href: "/dashboard", label: "Дашборд", icon: LayoutGrid },
      { href: "/dashboard/bookings", label: "Записи", icon: CalendarDays },
      { href: "/dashboard/clients", label: "Клиенты", icon: Contact2 },
    ],
  },
  {
    label: "Настройки",
    items: [
      { href: "/dashboard/services", label: "Услуги", icon: Scissors },
      { href: "/dashboard/staff", label: "Мастера", icon: Users },
      { href: "/dashboard/profile", label: "Моя страница", icon: Building2 },
      { href: "/dashboard/billing", label: "Тариф", icon: CreditCard },
    ],
  },
];

export function DashboardShell({
  children,
  user,
  business,
}: {
  children: React.ReactNode;
  user: { name: string; email: string };
  business: {
    name: string;
    slug: string;
    plan: string;
    trialEndsAt: string | null;
    trialDaysLeft: number | null;
    trialExpired: boolean;
  };
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const sidebar = (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="px-1 pt-1">
        <Logo />
      </div>

      <div className="flex items-center gap-3 rounded-2xl bg-paper p-2.5 ring-1 ring-black/[0.04]">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-ink text-[13px] font-semibold text-white">
          {(business.name || "U").slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold">{business.name || "Салон"}</p>
          <p className="truncate text-[11px] text-muted">/{business.slug || "salon"}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto">
        {NAV.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-2 text-[10px] font-semibold tracking-[0.16em] text-muted/80 uppercase">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                      active
                        ? "bg-ink text-white shadow-[0_10px_24px_-16px_rgba(11,11,16,0.9)]"
                        : "text-ink-soft hover:bg-paper"
                    }`}
                  >
                    <item.icon size={16} strokeWidth={1.6} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {business.plan === "TRIAL" ? (
        <div className="rounded-2xl bg-brand-soft p-3.5">
          <p className="text-[12px] font-semibold text-brand-dark">Пробный период</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-brand-dark/70">
            {business.trialEndsAt
              ? `До ${new Date(business.trialEndsAt).toLocaleDateString("ru-RU")}`
              : "14 дней бесплатно"}
          </p>
          <Link
            href="/dashboard/billing"
            className="mt-2.5 inline-flex text-[11.5px] font-semibold text-brand-dark underline underline-offset-4"
          >
            Выбрать тариф
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-mint/25 bg-mint/5 p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold text-ink">Тариф {business.plan || "PRO"}</p>
            <span className="rounded-full bg-mint/15 px-2 py-0.5 text-[9.5px] font-bold text-mint uppercase">
              Активен
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted">Подписка оплачена · Полный доступ</p>
          <Link
            href="/dashboard/billing"
            className="mt-2 inline-flex text-[11.5px] font-medium text-brand hover:underline"
          >
            Управление тарифом
          </Link>
        </div>
      )}

      <div className="flex items-center gap-2.5 border-t border-line pt-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-paper text-[11px] font-semibold text-ink-soft ring-1 ring-line">
          {(user.name || user.email || "U").slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium">{user.name || "Владелец"}</p>
          <p className="truncate text-[10.5px] text-muted">{user.email}</p>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            title="Выйти"
            className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-paper hover:text-ink"
          >
            <LogOut size={15} strokeWidth={1.6} />
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh bg-paper">
      {/* Desktop / Tablet Sidebar */}
      <aside className="sticky top-0 z-30 hidden h-dvh w-[240px] shrink-0 flex-col border-r border-line bg-white sm:flex">
        {sidebar}
      </aside>

      {/* Main Content Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile Top Header (< 640px) */}
        <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-white/90 px-4 backdrop-blur-xl sm:hidden">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="max-w-[140px] truncate text-[11px] font-medium text-muted">
              {business.name}
            </span>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-line bg-white px-2.5 py-1.5 text-[12px] font-medium text-ink shadow-sm"
            aria-label="Боковое меню"
          >
            <Menu size={16} strokeWidth={1.6} />
            <span>Боковое меню</span>
          </button>
        </div>

        {/* Mobile Drawer */}
        {open && (
          <div className="fixed inset-0 z-50 sm:hidden">
            <button
              className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
              onClick={() => setOpen(false)}
              aria-label="Закрыть меню"
            />
            <div className="absolute inset-y-0 left-0 w-[280px] bg-white shadow-lift">
              <button
                onClick={() => setOpen(false)}
                className="absolute top-4 right-4 z-10 grid size-8 place-items-center rounded-lg bg-paper"
                aria-label="Закрыть"
              >
                <X size={16} strokeWidth={1.6} />
              </button>
              {sidebar}
            </div>
          </div>
        )}

        {/* Mobile Bottom Navigation Bar */}
        <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-line bg-white/95 px-2 backdrop-blur-xl sm:hidden">
          <Link
            href="/dashboard"
            className={`flex flex-col items-center gap-1 py-1 text-[10px] font-medium transition-colors ${
              pathname === "/dashboard" ? "text-brand" : "text-muted hover:text-ink"
            }`}
          >
            <LayoutGrid size={18} strokeWidth={pathname === "/dashboard" ? 2 : 1.6} />
            <span>Дашборд</span>
          </Link>
          <Link
            href="/dashboard/bookings"
            className={`flex flex-col items-center gap-1 py-1 text-[10px] font-medium transition-colors ${
              pathname.startsWith("/dashboard/bookings") ? "text-brand" : "text-muted hover:text-ink"
            }`}
          >
            <CalendarDays size={18} strokeWidth={pathname.startsWith("/dashboard/bookings") ? 2 : 1.6} />
            <span>Записи</span>
          </Link>
          <Link
            href="/dashboard/clients"
            className={`flex flex-col items-center gap-1 py-1 text-[10px] font-medium transition-colors ${
              pathname.startsWith("/dashboard/clients") ? "text-brand" : "text-muted hover:text-ink"
            }`}
          >
            <Contact2 size={18} strokeWidth={pathname.startsWith("/dashboard/clients") ? 2 : 1.6} />
            <span>Клиенты</span>
          </Link>
          <Link
            href="/dashboard/services"
            className={`flex flex-col items-center gap-1 py-1 text-[10px] font-medium transition-colors ${
              pathname.startsWith("/dashboard/services") ? "text-brand" : "text-muted hover:text-ink"
            }`}
          >
            <Scissors size={18} strokeWidth={pathname.startsWith("/dashboard/services") ? 2 : 1.6} />
            <span>Услуги</span>
          </Link>
          <button
            onClick={() => setOpen(true)}
            className={`flex flex-col items-center gap-1 py-1 text-[10px] font-medium transition-colors ${
              open ? "text-brand" : "text-muted hover:text-ink"
            }`}
          >
            <Menu size={18} strokeWidth={1.6} />
            <span>Боковое меню</span>
          </button>
        </nav>

        {/* Main Content */}
        <main className="flex-1 pb-20 sm:pb-8">
          <div className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
            {business.trialExpired && pathname !== "/dashboard/billing" && (
              <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-rose/25 bg-rose/5 px-4 py-3">
                <AlertTriangle size={16} strokeWidth={1.7} className="shrink-0 text-rose" />
                <p className="flex-1 text-[12px] leading-relaxed text-rose">
                  Пробный период закончился. Создание мастеров, услуг, фото и правки страницы
                  заблокированы — записи клиентов продолжают работать.
                </p>
                <Link
                  href="/dashboard/billing"
                  className="rounded-full bg-rose px-3 py-1.5 text-[11px] font-semibold text-white transition hover:opacity-90"
                >
                  Подключить тариф
                </Link>
              </div>
            )}

            {!business.trialExpired &&
              business.plan === "TRIAL" &&
              business.trialDaysLeft != null &&
              business.trialDaysLeft <= 3 &&
              pathname !== "/dashboard/billing" && (
                <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-amber/25 bg-amber/5 px-4 py-3">
                  <AlertTriangle size={16} strokeWidth={1.7} className="shrink-0 text-amber" />
                  <p className="flex-1 text-[12px] leading-relaxed text-ink-soft">
                    Пробный период заканчивается через {business.trialDaysLeft} дн. Подключите
                    тариф, чтобы не потерять доступ к редактированию.
                  </p>
                  <Link
                    href="/dashboard/billing"
                    className="rounded-full bg-ink px-3 py-1.5 text-[11px] font-semibold text-white transition hover:opacity-90"
                  >
                    Выбрать тариф
                  </Link>
                </div>
              )}

            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
