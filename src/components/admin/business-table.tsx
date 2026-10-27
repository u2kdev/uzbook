"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  Loader2,
  Pause,
  Play,
  Search,
  Send,
  TimerReset,
} from "lucide-react";
import {
  extendTrialAction,
  setBusinessPlanAction,
  setBusinessStatusAction,
} from "@/server/actions/admin";
import { PLANS, planById, type PlanId } from "@/lib/plans";

export type AdminBusinessItem = {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: PlanId;
  trialEndsAt: string | null;
  createdAt: string;
  ownerName: string;
  ownerEmail: string;
  telegramLinked: boolean;
  pendingPlan: PlanId | null;
};

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-mint/10 text-mint",
  DRAFT: "bg-paper text-muted",
  SUSPENDED: "bg-rose/10 text-rose",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Активен",
  DRAFT: "Черновик",
  SUSPENDED: "Заблокирован",
};

export function BusinessTable({
  rows,
  canManage,
  initialQuery = "",
}: {
  rows: AdminBusinessItem[];
  canManage: boolean;
  initialQuery?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<"all" | "ACTIVE" | "SUSPENDED">("all");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== "all" && row.status !== filter) return false;
      if (!search) return true;
      return (
        row.name.toLowerCase().includes(search) ||
        row.slug.toLowerCase().includes(search) ||
        row.ownerEmail.toLowerCase().includes(search) ||
        row.ownerName.toLowerCase().includes(search)
      );
    });
  }, [rows, query, filter]);

  function run(action: () => Promise<unknown>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-full border border-line bg-white p-1">
          {(
            [
              ["all", "Все"],
              ["ACTIVE", "Активные"],
              ["SUSPENDED", "Блок"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`rounded-full px-3 py-1.5 text-[11.5px] font-medium transition-colors ${
                filter === value ? "bg-ink text-white" : "text-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="ml-auto flex h-9 w-full items-center gap-2 rounded-full border border-line bg-white px-3.5 sm:w-64">
          <Search size={14} strokeWidth={1.7} className="text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Название, slug, email…"
            className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted/70"
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-line bg-white/60 px-5 py-12 text-center text-[12.5px] text-muted">
          Ничего не найдено
        </div>
      ) : (
        <div className="overflow-hidden rounded-[20px] bg-white ring-1 ring-line/80">
          {filtered.map((row, index) => {
            const trialDays = row.trialEndsAt
              ? Math.max(
                  0,
                  Math.ceil((new Date(row.trialEndsAt).getTime() - Date.now()) / 86_400_000),
                )
              : null;

            return (
              <div
                key={row.id}
                className={`flex flex-wrap items-center gap-3 px-4 py-3.5 ${
                  index > 0 ? "border-t border-line/70" : ""
                }`}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-paper text-[12px] font-semibold text-ink-soft">
                  {row.name.slice(0, 1).toUpperCase()}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-[13px] font-semibold">{row.name}</p>
                    <span className="text-[10.5px] text-muted">/{row.slug}</span>
                    {row.telegramLinked && (
                      <span title="Telegram подключён" className="text-[#229ed9]">
                        <Send size={11} strokeWidth={2} />
                      </span>
                    )}
                    {row.pendingPlan && (
                      <span className="rounded-full bg-amber/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber">
                        заявка · {planById(row.pendingPlan).name}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-muted">
                    {row.ownerName} · {row.ownerEmail}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                      STATUS_STYLE[row.status] ?? "bg-paper text-muted"
                    }`}
                  >
                    {STATUS_LABEL[row.status] ?? row.status}
                  </span>
                  {row.plan === "TRIAL" && trialDays != null && (
                    <span className="rounded-full bg-brand-soft px-2 py-1 text-[10px] font-semibold text-brand-dark">
                      trial · {trialDays} дн
                    </span>
                  )}
                </div>

                {canManage ? (
                  <select
                    value={row.plan}
                    disabled={pending}
                    onChange={(event) => {
                      const plan = event.target.value as PlanId;
                      run(() => setBusinessPlanAction(row.id, plan));
                    }}
                    className="h-8 rounded-lg border border-line bg-white px-2 text-[11px] font-medium outline-none"
                    aria-label="Тариф"
                  >
                    {PLANS.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="rounded-lg border border-line px-2 py-1 text-[11px] font-medium">
                    {planById(row.plan).name}
                  </span>
                )}

                <div className="flex items-center gap-1">
                  <Link
                    href={`/${row.slug}`}
                    target="_blank"
                    className="grid size-8 place-items-center rounded-lg text-muted hover:bg-paper hover:text-ink"
                    title="Открыть страницу"
                  >
                    <ArrowUpRight size={14} />
                  </Link>

                  {canManage && (
                    <>
                      <button
                        onClick={() => run(() => extendTrialAction(row.id, 7))}
                        disabled={pending}
                        className="grid size-8 place-items-center rounded-lg text-muted hover:bg-paper hover:text-ink"
                        title="Продлить пробный на 7 дней"
                      >
                        <TimerReset size={14} />
                      </button>
                      <button
                        onClick={() =>
                          run(() =>
                            setBusinessStatusAction(
                              row.id,
                              row.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
                            ),
                          )
                        }
                        disabled={pending}
                        className={`grid size-8 place-items-center rounded-lg ${
                          row.status === "ACTIVE"
                            ? "text-muted hover:bg-rose/5 hover:text-rose"
                            : "text-mint hover:bg-mint/5"
                        }`}
                        title={row.status === "ACTIVE" ? "Заблокировать" : "Разблокировать"}
                      >
                        {pending ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : row.status === "ACTIVE" ? (
                          <Pause size={14} />
                        ) : (
                          <Play size={14} />
                        )}
                      </button>
                    </>
                  )}
                </div>

                {row.status === "ACTIVE" && canManage && (
                  <span className="hidden items-center gap-1 text-[10px] text-muted xl:flex">
                    <Check size={11} className="text-mint" /> публично
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-muted">
        Показано {filtered.length} из {rows.length}. Тариф меняется сразу, блокировка скрывает
        страницу записи.
      </p>
    </div>
  );
}
