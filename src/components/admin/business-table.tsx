"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  CreditCard,
  Loader2,
  Pause,
  Percent,
  Phone,
  Play,
  Search,
  SlidersHorizontal,
  TimerReset,
  Users,
  X,
} from "lucide-react";
import {
  extendTrialAction,
  setBusinessPlanAction,
  setBusinessStatusAction,
  updateBusinessCustomPlanConfigAction,
} from "@/server/actions/admin";
import {
  BILLING_PERIODS,
  calculatePlanPrice,
  formatMoney,
  PLANS,
  planById,
  type BillingPeriodMonths,
  type PlanId,
} from "@/lib/plans";

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
  ownerPhone?: string | null;
  providerName?: string | null;
  customStaffLimit?: number | null;
  customClientLimit?: number | null;
  customPriceUzs?: number | null;
  customPlanName?: string | null;
  discountPercent?: number | null;
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

  // Custom Plan Modal state
  const [configBusiness, setConfigBusiness] = useState<AdminBusinessItem | null>(null);
  const [modalPlan, setModalPlan] = useState<PlanId>("PRO");
  const [customPlanName, setCustomPlanName] = useState("");
  const [customPriceUzs, setCustomPriceUzs] = useState<string>("");
  const [discountPercent, setDiscountPercent] = useState<string>("0");
  const [customStaffLimit, setCustomStaffLimit] = useState<string>("");
  const [customClientLimit, setCustomClientLimit] = useState<string>("");
  const [billingMonths, setBillingMonths] = useState<BillingPeriodMonths>(1);
  const [modalMessage, setModalMessage] = useState<string | null>(null);

  function openConfig(b: AdminBusinessItem) {
    setConfigBusiness(b);
    setModalPlan(b.plan);
    setCustomPlanName(b.customPlanName ?? "");
    setCustomPriceUzs(b.customPriceUzs ? String(b.customPriceUzs) : "");
    setDiscountPercent(b.discountPercent ? String(b.discountPercent) : "0");
    setCustomStaffLimit(b.customStaffLimit ? String(b.customStaffLimit) : "");
    setCustomClientLimit(b.customClientLimit ? String(b.customClientLimit) : "");
    setBillingMonths(1);
    setModalMessage(null);
  }

  function closeConfig() {
    if (pending) return;
    setConfigBusiness(null);
    setModalMessage(null);
  }

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== "all" && row.status !== filter) return false;
      if (!search) return true;
      return (
        row.name.toLowerCase().includes(search) ||
        row.slug.toLowerCase().includes(search) ||
        row.ownerEmail.toLowerCase().includes(search) ||
        row.ownerName.toLowerCase().includes(search) ||
        (row.ownerPhone && row.ownerPhone.toLowerCase().includes(search))
      );
    });
  }, [rows, query, filter]);

  function run(action: () => Promise<unknown>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  // Real-time calculation for modal
  const baseMonthlyPrice =
    customPriceUzs && Number(customPriceUzs) > 0
      ? Number(customPriceUzs)
      : planById(modalPlan).priceUzs;

  const currentPricing = calculatePlanPrice({
    baseMonthlyPrice,
    months: billingMonths,
    customDiscountPercent: Number(discountPercent) || 0,
  });

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
                    <p className="truncate text-[13px] font-semibold text-ink">{row.name}</p>
                    <span className="text-[10.5px] text-muted">/{row.slug}</span>
                    {row.customPlanName && (
                      <span className="rounded-full bg-brand-soft px-1.5 py-0.5 text-[9px] font-semibold text-brand-dark">
                        {row.customPlanName}
                      </span>
                    )}
                    {row.discountPercent != null && row.discountPercent > 0 && (
                      <span className="rounded-full bg-mint/10 px-1.5 py-0.5 text-[9px] font-semibold text-mint">
                        -{row.discountPercent}% скидка
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
                    {row.ownerPhone ? ` · тел: ${row.ownerPhone}` : ""}
                    {row.providerName ? ` · провайдер: ${row.providerName}` : ""}
                    {row.customStaffLimit ? ` · до ${row.customStaffLimit} сотр.` : ""}
                    {row.customClientLimit ? ` · до ${row.customClientLimit} кл.` : ""}
                    {row.customPriceUzs ? ` · ${formatMoney(row.customPriceUzs)}/мес` : ""}
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
                        onClick={() => openConfig(row)}
                        disabled={pending}
                        className="grid size-8 place-items-center rounded-lg text-muted hover:bg-paper hover:text-ink"
                        title="Настроить тариф, скидку и лимиты"
                      >
                        <SlidersHorizontal size={14} />
                      </button>

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

      {/* CUSTOM PLAN & DISCOUNT CONFIGURATION MODAL */}
      {configBusiness && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-3 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-[26px] bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-line px-5 py-4">
              <div>
                <span className="badge">
                  <SlidersHorizontal size={12} /> Настройка тарифа и скидок
                </span>
                <h3 className="mt-1 text-[17px] font-semibold text-ink">
                  {configBusiness.name}
                  <span className="ml-2 font-normal text-[12px] text-muted">
                    /{configBusiness.slug}
                  </span>
                </h3>
              </div>
              <button
                type="button"
                onClick={closeConfig}
                disabled={pending}
                className="grid size-8 place-items-center rounded-full bg-paper text-muted hover:text-ink disabled:opacity-50"
              >
                <X size={15} />
              </button>
            </div>

            <div className="max-h-[75vh] space-y-4 overflow-y-auto px-5 py-4">
              {modalMessage && (
                <div className="rounded-xl border border-mint/20 bg-mint/5 px-3.5 py-2.5 text-[12.5px] font-medium text-mint">
                  {modalMessage}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label-base">Базовый тариф</label>
                  <select
                    value={modalPlan}
                    onChange={(e) => setModalPlan(e.target.value as PlanId)}
                    className="input-base"
                  >
                    {PLANS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({formatMoney(p.priceUzs)}/мес)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label-base">Кастомное имя тарифа</label>
                  <input
                    value={customPlanName}
                    onChange={(e) => setCustomPlanName(e.target.value)}
                    placeholder="Например: VIP Индивидуальный"
                    className="input-base"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label-base">Базовая цена в месяц (UZS)</label>
                  <input
                    type="number"
                    value={customPriceUzs}
                    onChange={(e) => setCustomPriceUzs(e.target.value)}
                    placeholder={`По умолчанию: ${planById(modalPlan).priceUzs}`}
                    className="input-base font-mono"
                  />
                  <span className="mt-0.5 block text-[10.5px] text-muted">
                    Оставьте пустым для стандартной цены тарифа
                  </span>
                </div>

                <div>
                  <label className="label-base">Скидка администратора (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={90}
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    placeholder="0"
                    className="input-base font-semibold text-brand"
                  />
                  <div className="mt-1 flex flex-wrap gap-1">
                    {[0, 10, 15, 20, 30, 50].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setDiscountPercent(String(pct))}
                        className={`rounded-md border px-2 py-0.5 text-[10.5px] font-semibold ${
                          Number(discountPercent) === pct
                            ? "border-brand bg-brand-soft text-brand-dark"
                            : "border-line text-muted hover:text-ink"
                        }`}
                      >
                        {pct === 0 ? "0%" : `-${pct}%`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label-base">Лимит мастеров</label>
                  <input
                    type="number"
                    value={customStaffLimit}
                    onChange={(e) => setCustomStaffLimit(e.target.value)}
                    placeholder={`По тарифу: ${planById(modalPlan).staffLimit}`}
                    className="input-base"
                  />
                </div>

                <div>
                  <label className="label-base">Лимит клиентов</label>
                  <input
                    type="number"
                    value={customClientLimit}
                    onChange={(e) => setCustomClientLimit(e.target.value)}
                    placeholder="Без ограничений"
                    className="input-base"
                  />
                </div>
              </div>

              <div>
                <label className="label-base">Срок оплаты (1, 3, 6 или 12 месяцев)</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {BILLING_PERIODS.map((bp) => (
                    <button
                      key={bp.months}
                      type="button"
                      onClick={() => setBillingMonths(bp.months)}
                      className={`flex flex-col items-center justify-center rounded-xl border p-2 text-center transition ${
                        billingMonths === bp.months
                          ? "border-ink bg-ink text-white"
                          : "border-line bg-paper/50 text-ink hover:bg-paper"
                      }`}
                    >
                      <span className="text-[12px] font-semibold">{bp.label}</span>
                      {bp.badge && (
                        <span
                          className={`mt-0.5 rounded-full px-1.5 py-0.2 text-[9px] font-bold ${
                            billingMonths === bp.months
                              ? "bg-white/20 text-white"
                              : "bg-mint/15 text-mint"
                          }`}
                        >
                          {bp.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* LIVE CALCULATION SUMMARY */}
              <div className="rounded-2xl border border-line bg-paper/60 p-3.5">
                <div className="flex items-center justify-between text-[11.5px] text-muted">
                  <span>Расчёт стоимости на выбранный период:</span>
                  {currentPricing.discountPercent > 0 && (
                    <span className="rounded-full bg-mint/15 px-2 py-0.5 text-[10px] font-bold text-mint">
                      Итоговая скидка: -{currentPricing.discountPercent}%
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-[20px] font-bold tracking-tight text-ink">
                    {formatMoney(currentPricing.totalAmountUzs)}
                  </span>
                  <span className="text-[12px] font-medium text-muted">
                    {formatMoney(currentPricing.pricePerMonthUzs)} / месяц
                  </span>
                </div>
                {currentPricing.savingsUzs > 0 && (
                  <p className="mt-1 text-[11px] font-medium text-mint">
                    Клиент сэкономит {formatMoney(currentPricing.savingsUzs)} при оплате на{" "}
                    {billingMonths === 1 ? "1 месяц" : billingMonths === 12 ? "1 год" : `${billingMonths} мес`}.
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-paper/30 px-5 py-3.5">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    await updateBusinessCustomPlanConfigAction(configBusiness.id, {
                      customPlanName: customPlanName.trim() || null,
                      customPriceUzs: customPriceUzs ? Number(customPriceUzs) : null,
                      discountPercent: discountPercent ? Number(discountPercent) : null,
                      customStaffLimit: customStaffLimit ? Number(customStaffLimit) : null,
                      customClientLimit: customClientLimit ? Number(customClientLimit) : null,
                    });
                    setModalMessage("Параметры сохранены. Клиент увидит их при входе в «Тариф».");
                    router.refresh();
                  });
                }}
                className="btn btn-ghost h-9 px-3.5 text-[12px]"
              >
                Сохранить параметры
              </button>

              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    await setBusinessPlanAction(configBusiness.id, modalPlan, {
                      months: billingMonths,
                      customPlanName: customPlanName.trim() || null,
                      customPriceUzs: customPriceUzs ? Number(customPriceUzs) : null,
                      discountPercent: discountPercent ? Number(discountPercent) : null,
                      customStaffLimit: customStaffLimit ? Number(customStaffLimit) : null,
                      customClientLimit: customClientLimit ? Number(customClientLimit) : null,
                    });
                    setConfigBusiness(null);
                    router.refresh();
                  });
                }}
                className="btn btn-primary h-9 px-4 text-[12px]"
              >
                {pending ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Check size={13} />
                )}
                Активировать подписку на {billingMonths} мес
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
