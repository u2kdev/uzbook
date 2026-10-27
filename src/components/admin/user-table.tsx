"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, Send } from "lucide-react";
import { setUserRoleAction } from "@/server/actions/admin";

export type AdminUserItem = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "OWNER" | "SUPPORT" | "ADMIN";
  telegramLinked: boolean;
  createdAt: string;
  businessesCount: number;
  businessNames: string[];
  isSelf: boolean;
};

const ROLE_STYLE: Record<string, string> = {
  OWNER: "bg-paper text-ink-soft",
  SUPPORT: "bg-brand-soft text-brand-dark",
  ADMIN: "bg-ink text-white",
};

export function UserTable({
  rows,
  canManage,
}: {
  rows: AdminUserItem[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return rows;
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(search) ||
        row.email.toLowerCase().includes(search) ||
        row.businessNames.some((name) => name.toLowerCase().includes(search)),
    );
  }, [rows, query]);

  return (
    <div className="space-y-4">
      <label className="flex h-9 w-full items-center gap-2 rounded-full border border-line bg-white px-3.5 sm:w-72">
        <Search size={14} strokeWidth={1.7} className="text-muted" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Имя, email, бизнес…"
          className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted/70"
        />
      </label>

      <div className="overflow-hidden rounded-[20px] bg-white ring-1 ring-line/80">
        {filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-[12px] text-muted">Ничего не найдено</p>
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
                <p className="flex items-center gap-1.5 truncate text-[12.5px] font-semibold">
                  {row.name}
                  {row.isSelf && (
                    <span className="rounded-full bg-brand-soft px-1.5 py-0.5 text-[9px] font-semibold text-brand-dark">
                      вы
                    </span>
                  )}
                  {row.telegramLinked && (
                    <span title="Telegram подключён" className="text-[#229ed9]">
                      <Send size={11} strokeWidth={2} />
                    </span>
                  )}
                </p>
                <p className="mt-0.5 truncate text-[10.5px] text-muted">
                  {row.email}
                  {row.phone ? ` · ${row.phone}` : ""}
                </p>
              </div>

              <p className="hidden max-w-[220px] truncate text-[11px] text-muted lg:block">
                {row.businessNames.length > 0 ? row.businessNames.join(", ") : "без бизнеса"}
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
                  <option value="OWNER">Владелец</option>
                  <option value="SUPPORT">Поддержка</option>
                  <option value="ADMIN">Админ</option>
                </select>
              ) : (
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                    ROLE_STYLE[row.role] ?? "bg-paper text-muted"
                  }`}
                >
                  {row.role === "OWNER" ? "Владелец" : row.role === "SUPPORT" ? "Поддержка" : "Админ"}
                </span>
              )}

              {pending && <Loader2 size={13} className="animate-spin text-muted" />}
            </div>
          ))
        )}
      </div>

      <p className="text-[11px] text-muted">
        Всего {rows.length} пользователей. Роли меняются только администратором; поддержка видит
        данные без права менять тарифы.
      </p>
    </div>
  );
}
