"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Handshake, Loader2, Search, Shield, ShieldCheck, Store, Users } from "lucide-react";
import { setUserRoleAction } from "@/server/actions/admin";

export type AdminUserItem = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  phone: string | null;
  role: "OWNER" | "SUPPORT" | "ADMIN" | "PROVIDER";
  commissionPercent: number;
  payoutCard: string | null;
  createdAt: string;
  businessesCount: number;
  businessNames: string[];
  connectedByProviderCount: number;
  isSelf: boolean;
};

const ROLE_STYLE: Record<string, string> = {
  OWNER: "bg-paper text-ink-soft",
  SUPPORT: "bg-brand-soft text-brand-dark",
  PROVIDER: "bg-mint/15 text-mint",
  ADMIN: "bg-ink text-white",
};

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Клиент (Салон)",
  SUPPORT: "Саппорт",
  PROVIDER: "Провайдер",
  ADMIN: "Админ",
};

const ROLE_TABS = [
  { id: "ALL", label: "Все", icon: Users },
  { id: "ADMIN", label: "Админы", icon: ShieldCheck },
  { id: "SUPPORT", label: "Саппорты", icon: Shield },
  { id: "PROVIDER", label: "Провайдеры", icon: Handshake },
  { id: "OWNER", label: "Клиенты (Салоны)", icon: Store },
] as const;

export function UserTable({
  rows,
  canManage,
}: {
  rows: AdminUserItem[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const counts = useMemo(() => {
    return {
      ALL: rows.length,
      ADMIN: rows.filter((r) => r.role === "ADMIN").length,
      SUPPORT: rows.filter((r) => r.role === "SUPPORT").length,
      PROVIDER: rows.filter((r) => r.role === "PROVIDER").length,
      OWNER: rows.filter((r) => r.role === "OWNER").length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (roleFilter !== "ALL" && row.role !== roleFilter) return false;
      if (!search) return true;
      return (
        row.name.toLowerCase().includes(search) ||
        row.email.toLowerCase().includes(search) ||
        (row.username && row.username.toLowerCase().includes(search)) ||
        row.businessNames.some((name) => name.toLowerCase().includes(search))
      );
    });
  }, [rows, roleFilter, query]);

  return (
    <div className="space-y-4">
      {/* Separate Role Lists Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-line bg-white p-1.5">
          {ROLE_TABS.map((tab) => {
            const active = roleFilter === tab.id;
            const Icon = tab.icon;
            const countVal = counts[tab.id as keyof typeof counts] ?? 0;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setRoleFilter(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold transition-all ${
                  active
                    ? "bg-ink text-white shadow-xs"
                    : "text-ink-soft hover:bg-paper"
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    active ? "bg-white/20 text-white" : "bg-paper text-muted"
                  }`}
                >
                  {countVal}
                </span>
              </button>
            );
          })}
        </div>

        <label className="flex h-10 w-full items-center gap-2 rounded-full border border-line bg-white px-3.5 sm:w-72">
          <Search size={14} strokeWidth={1.7} className="text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Имя, никнейм, email, салон…"
            className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted/70"
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-[20px] bg-white ring-1 ring-line/80">
        {filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-[12px] text-muted">
            В этой категории пока нет пользователей
          </p>
        ) : (
          filtered.map((row, index) => (
            <div
              key={row.id}
              className={`flex flex-wrap items-center gap-3 px-4 py-3.5 ${
                index > 0 ? "border-t border-line/70" : ""
              }`}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-paper text-[11px] font-semibold text-ink-soft ring-1 ring-line">
                {row.name.slice(0, 1).toUpperCase()}
              </span>

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-semibold">
                  <span>{row.name}</span>
                  {row.username && (
                    <span className="rounded-md bg-brand-soft px-1.5 py-0.5 font-mono text-[10.5px] text-brand-dark">
                      @{row.username}
                    </span>
                  )}
                  {row.role === "PROVIDER" && (
                    <span className="rounded-full bg-mint/15 px-2 py-0.5 text-[10px] font-bold text-mint">
                      {row.commissionPercent}% · подключил {row.connectedByProviderCount} сал.
                    </span>
                  )}
                  {row.isSelf && (
                    <span className="rounded-full bg-brand-soft px-1.5 py-0.5 text-[9px] font-semibold text-brand-dark">
                      вы
                    </span>
                  )}
                </p>
                <p className="mt-0.5 truncate text-[10.5px] text-muted">
                  {row.email}
                  {row.phone ? ` · ${row.phone}` : ""}
                  {row.payoutCard ? ` · 💳 ${row.payoutCard}` : ""}
                </p>
              </div>

              <p className="hidden max-w-[220px] truncate text-[11px] text-muted lg:block">
                {row.role === "PROVIDER"
                  ? `Подключено салонов: ${row.connectedByProviderCount}`
                  : row.businessNames.length > 0
                  ? row.businessNames.join(", ")
                  : "без салона"}
              </p>

              <span className="text-[10.5px] text-muted">
                {new Intl.DateTimeFormat("ru-RU", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                }).format(new Date(row.createdAt))}
              </span>

              {canManage && !row.isSelf ? (
                <select
                  value={row.role}
                  disabled={pending}
                  onChange={(event) => {
                    const role = event.target.value as AdminUserItem["role"];
                    startTransition(async () => {
                      await setUserRoleAction(row.id, role);
                      router.refresh();
                    });
                  }}
                  className="h-8 rounded-lg border border-line bg-white px-2 text-[11px] font-medium outline-none"
                  aria-label="Роль"
                >
                  <option value="OWNER">Клиент (Салон)</option>
                  <option value="PROVIDER">Провайдер</option>
                  <option value="SUPPORT">Саппорт</option>
                  <option value="ADMIN">Админ</option>
                </select>
              ) : (
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                    ROLE_STYLE[row.role] ?? "bg-paper text-muted"
                  }`}
                >
                  {ROLE_LABEL[row.role] ?? row.role}
                </span>
              )}

              {pending && <Loader2 size={13} className="animate-spin text-muted" />}
            </div>
          ))
        )}
      </div>

      <p className="text-[11px] text-muted">
        Переключайте вкладки выше, чтобы смотреть отдельно список Админов, Саппортов, Провайдеров и Клиентов (владельцев салонов).
      </p>
    </div>
  );
}
