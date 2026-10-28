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
      { href: "/dashboard", label: "Обзор дня", icon: LayoutGrid },
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
          {business.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold">{business.name}</p>
          <p className="truncate text-[11px] text-muted">/{business.slug}</p>
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

      {business.plan === "TRIAL" && (
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
      )}

      <div className="flex items-center gap-2.5 border-t border-line pt-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-paper text-[11px] font-semibold text-ink-soft ring-1 ring-line">
          {user.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium">{user.name}</p>
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
    <div className="min-h-dvh bg-paper">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-line bg-white lg:block">
        {sidebar}
      </aside>

      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-white/90 px-4 backdrop-blur-xl lg:hidden">
        <Logo />
        <button
          onClick={() => setOpen(true)}
          className="grid size-9 place-items-center rounded-lg border border-line"
          aria-label="Меню"
        >
          <Menu size={17} strokeWidth={1.6} />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
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

      <main className="lg:pl-[248px]">
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
  );
}
