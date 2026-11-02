"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronRight,
  Coins,
  CreditCard,
  FlaskConical,
  Landmark,
  Loader2,
  Percent,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import {
  cancelPlanRequestAction,
  requestPlanAction,
} from "@/server/actions/profile";
import { startPaymentAction, type PaymentActionState } from "@/server/actions/payments";
import {
  BILLING_PERIODS,
  calculatePlanPrice,
  formatMoney,
  PLANS,
  type BillingPeriodMonths,
  type PlanId,
} from "@/lib/plans";

type ProviderId = "PAYME" | "CLICK" | "DEMO" | "MANUAL" | "CRYPTO";

type Provider = {
  id: ProviderId;
  label: string;
  hint: string;
  test?: boolean;
};

const PROVIDER_ICONS: Record<ProviderId, typeof CreditCard> = {
  PAYME: CreditCard,
  CLICK: CreditCard,
  DEMO: FlaskConical,
  MANUAL: Landmark,
  CRYPTO: Coins,
};

export function BillingPlans({
  currentPlan,
  pendingPlan,
  pendingId,
  currency,
  providers,
  customPriceUzs,
  customStaffLimit,
  customClientLimit,
  customPlanName,
  discountPercent,
}: {
  currentPlan: PlanId;
  pendingPlan: PlanId | null;
  pendingId: string | null;
  currency: string;
  providers: Provider[];
  customPriceUzs?: number | null;
  customStaffLimit?: number | null;
  customClientLimit?: number | null;
  customPlanName?: string | null;
  discountPercent?: number | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<PlanId | null>(null);
  const [selectedMonths, setSelectedMonths] = useState<BillingPeriodMonths>(1);
  const [busyProvider, setBusyProvider] = useState<ProviderId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cancelling, startCancel] = useTransition();
  const [pending, startTransition] = useTransition();

  const hasCustomPrice =
    customPriceUzs !== null && customPriceUzs !== undefined && customPriceUzs > 0;
  const hasAdminDiscount =
    discountPercent !== null && discountPercent !== undefined && discountPercent > 0;

  function basePrice(plan: (typeof PLANS)[number]): number {
    if (plan.id === "TRIAL") return 0;
    return hasCustomPrice ? customPriceUzs! : plan.priceUzs;
  }

  function planPricing(plan: (typeof PLANS)[number], months: BillingPeriodMonths) {
    const base = basePrice(plan);
    return calculatePlanPrice({
      baseMonthlyPrice: base,
      months,
      customDiscountPercent: discountPercent ?? 0,
    });
  }

  const selectedPlan = selected ? PLANS.find((plan) => plan.id === selected) ?? null : null;
  const activePricing = selectedPlan ? planPricing(selectedPlan, selectedMonths) : null;

  function close() {
    if (pending) return;
    setSelected(null);
    setError(null);
  }

  function pay(provider: Provider) {
    if (!selected) return;
    setError(null);
    setNotice(null);

    if (provider.id === "MANUAL") {
      setBusyProvider("MANUAL");
      startTransition(async () => {
        const formData = new FormData();
        formData.set("plan", selected);
        formData.set("months", String(selectedMonths));
        const result = await requestPlanAction(null, formData);
        setBusyProvider(null);
        if (result?.error) {
          setError(result.error);
          return;
        }
        setSelected(null);
        setNotice(
          `Заявка на ${selectedMonths} мес. отправлена. Администратор подтвердит оплату и включит тариф.`,
        );
        router.refresh();
      });
      return;
    }

    setBusyProvider(provider.id);
    startTransition(async () => {
      const result: PaymentActionState = await startPaymentAction(
        selected,
        provider.id as Exclude<ProviderId, "MANUAL">,
        selectedMonths,
      );
      if (result?.error || !result?.url) {
        setBusyProvider(null);
        setError(result?.error ?? "Не удалось создать платёж");
        return;
      }
      window.location.assign(result.url);
    });
  }

  return (
    <div className="space-y-4">
      {notice && (
        <div className="rounded-xl border border-mint/20 bg-mint/5 px-3.5 py-2.5 text-[12.5px] text-mint">
          {notice}
        </div>
      )}
      {error && !selected && (
        <div className="rounded-xl border border-rose/20 bg-rose/5 px-3.5 py-2.5 text-[12.5px] text-rose">
          {error}
        </div>
      )}

      {hasAdminDiscount && (
        <div className="flex items-center gap-3 rounded-2xl border border-mint/30 bg-mint/10 p-3.5 text-[12.5px] text-ink">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-mint text-white">
            <Percent size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-mint">
              Персональная скидка {discountPercent}% от платформы
            </p>
            <p className="mt-0.5 text-[11.5px] text-ink-soft">
              Для вашего бизнеса действует персональная скидка {discountPercent}%. При оплате на 3, 6 или 12 месяцев
              скидка суммируется со скидкой за период!
            </p>
          </div>
        </div>
      )}

      {(hasCustomPrice || customStaffLimit || customClientLimit || customPlanName) && (
        <div className="rounded-2xl border border-brand/25 bg-brand-soft/40 px-4 py-3 text-[12px] leading-relaxed text-ink-soft">
          <span className="font-semibold text-ink">
            {customPlanName ? `Специальный тариф «${customPlanName}»:` : "Индивидуальные условия:"}
          </span>{" "}
          {hasCustomPrice && (
            <span>
              базовая стоимость <b>{formatMoney(customPriceUzs!, currency)} / мес</b>
            </span>
          )}
          {customStaffLimit ? (
            <span>
              {hasCustomPrice ? " · " : ""}до <b>{customStaffLimit}</b> мастеров
            </span>
          ) : null}
          {customClientLimit ? (
            <span>
              {hasCustomPrice || customStaffLimit ? " · " : ""}до <b>{customClientLimit}</b> клиентов
            </span>
          ) : null}
        </div>
      )}

      {/* DURATION SELECTOR TABS */}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Выберите период оплаты</h2>
          <p className="text-[11.5px] text-muted">
            Оплата на длительный срок выгоднее — скидка применяется ко всей стоимости.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 rounded-full border border-line bg-white p-1">
          {BILLING_PERIODS.map((bp) => (
            <button
              key={bp.months}
              type="button"
              onClick={() => setSelectedMonths(bp.months)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-medium transition ${
                selectedMonths === bp.months
                  ? "bg-ink text-white shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              <span>{bp.label}</span>
              {bp.badge && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[9px] font-bold ${
                    selectedMonths === bp.months
                      ? "bg-white/25 text-white"
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

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const isPending = plan.id === pendingPlan;
          const pricing = planPricing(plan, selectedMonths);

          return (
            <div
              key={plan.id}
              className={`flex flex-col rounded-[24px] p-1.5 ring-1 ${
                plan.highlighted ? "bg-ink/10 ring-ink/10" : "bg-white/60 ring-black/[0.05]"
              }`}
            >
              <div
                className={`flex h-full flex-col rounded-[calc(24px-6px)] p-5 ${
                  plan.highlighted
                    ? "bg-ink text-white ring-1 ring-white/10"
                    : "bg-white ring-1 ring-black/[0.03]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[14px] font-semibold">{plan.name}</p>
                  {isCurrent ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9.5px] font-semibold uppercase ${
                        plan.highlighted ? "bg-white/10 text-white/80" : "bg-mint/10 text-mint"
                      }`}
                    >
                      Текущий
                    </span>
                  ) : plan.highlighted ? (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9.5px] font-semibold uppercase">
                      Выбор
                    </span>
                  ) : null}
                </div>
                <p
                  className={`mt-1 text-[11.5px] leading-relaxed ${
                    plan.highlighted ? "text-white/55" : "text-muted"
                  }`}
                >
                  {plan.tagline}
                </p>

                <div className="mt-4 flex flex-col gap-0.5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[24px] leading-none font-semibold tracking-tight">
                      {pricing.totalAmountUzs === 0
                        ? "0"
                        : formatMoney(pricing.totalAmountUzs, currency)}
                    </span>
                    <span
                      className={`text-[11px] ${
                        plan.highlighted ? "text-white/50" : "text-muted"
                      }`}
                    >
                      {plan.id === "TRIAL"
                        ? "14 дней"
                        : `за ${selectedMonths === 1 ? "1 месяц" : selectedMonths === 12 ? "1 год" : `${selectedMonths} мес`}`}
                    </span>
                  </div>

                  {plan.id !== "TRIAL" && (
                    <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                      <span className={plan.highlighted ? "text-white/60" : "text-muted"}>
                        {formatMoney(pricing.pricePerMonthUzs, currency)} / мес
                      </span>
                      {pricing.discountPercent > 0 && (
                        <span className="rounded-full bg-mint/20 px-1.5 py-0.2 text-[9.5px] font-bold text-mint">
                          -{pricing.discountPercent}%
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <ul className="mt-4 flex-1 space-y-1.5">
                  {plan.features.slice(0, 4).map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-[11.5px]">
                      <Check
                        size={13}
                        strokeWidth={2}
                        className={`mt-0.5 shrink-0 ${
                          plan.highlighted ? "text-brand" : "text-mint"
                        }`}
                      />
                      <span className={plan.highlighted ? "text-white/75" : "text-ink-soft"}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {plan.id === "TRIAL" ? (
                  <div className="mt-5 h-9 rounded-full border border-dashed border-line/80 text-center text-[11px] leading-9 text-muted">
                    Пробный период
                  </div>
                ) : (
                  <div className="mt-5 flex items-center gap-2">
                    {isPending && (
                      <span className="rounded-full bg-amber/10 px-2 py-1 text-[9.5px] font-semibold text-amber">
                        Заявка
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setNotice(null);
                        setSelected(plan.id);
                      }}
                      className={`btn h-9 flex-1 text-[11.5px] ${
                        plan.highlighted ? "btn-accent" : "btn-ghost"
                      }`}
                    >
                      {isCurrent ? "Продлить" : isPending ? "Оплатить онлайн" : "Подключить"}
                      <ChevronRight size={13} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {pendingPlan && pendingId && (
        <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-muted">
          <span>
            Сейчас ожидает подтверждения тариф{" "}
            {PLANS.find((plan) => plan.id === pendingPlan)?.name}.
          </span>
          <button
            type="button"
            disabled={cancelling}
            onClick={() => {
              startCancel(async () => {
                const result = await cancelPlanRequestAction(pendingId);
                if (result?.error) return;
                router.refresh();
              });
            }}
            className="font-semibold underline underline-offset-4 disabled:opacity-60"
          >
            Отменить заявку
          </button>
        </div>
      )}

      {/* PAYMENT MODAL */}
      {selectedPlan && activePricing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-3 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md overflow-hidden rounded-[26px] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-line/70 px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
                  Оплата тарифа
                </p>
                <h3 className="mt-1 text-[19px] font-semibold tracking-[-0.02em] text-ink">
                  {customPlanName || selectedPlan.name} · {formatMoney(activePricing.totalAmountUzs, currency)}
                </h3>
                <p className="mt-0.5 text-[11.5px] text-muted">
                  Период: {selectedMonths === 1 ? "1 месяц (30 дней)" : selectedMonths === 12 ? "12 месяцев (1 год)" : `${selectedMonths} месяцев`}
                  {activePricing.discountPercent > 0 && ` · Скидка: ${activePricing.discountPercent}%`}
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={pending}
                className="grid size-8 place-items-center rounded-full bg-paper text-muted transition hover:text-ink disabled:opacity-50"
                aria-label="Закрыть"
              >
                <X size={15} />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
              {/* Change duration directly in modal */}
              <div className="mb-4">
                <label className="label-base">Период подписки</label>
                <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                  {BILLING_PERIODS.map((bp) => (
                    <button
                      key={bp.months}
                      type="button"
                      onClick={() => setSelectedMonths(bp.months)}
                      className={`flex flex-col items-center justify-center rounded-xl border p-2 text-center transition ${
                        selectedMonths === bp.months
                          ? "border-ink bg-ink text-white"
                          : "border-line bg-paper/50 text-ink hover:bg-paper"
                      }`}
                    >
                      <span className="text-[11px] font-semibold">{bp.label.split(" ")[0]} мес</span>
                      {bp.badge && (
                        <span
                          className={`mt-0.5 rounded-full px-1.5 py-0.2 text-[8.5px] font-bold ${
                            selectedMonths === bp.months
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

              <p className="text-[11.5px] text-muted">Выберите способ оплаты</p>
              <div className="mt-2.5 space-y-2">
                {providers.map((provider) => {
                  const Icon = PROVIDER_ICONS[provider.id] ?? CreditCard;
                  const isBusy = busyProvider === provider.id;

                  return (
                    <button
                      key={provider.id}
                      type="button"
                      onClick={() => pay(provider)}
                      disabled={pending}
                      className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left ring-1 ring-line/80 transition hover:bg-paper/70 disabled:opacity-60"
                    >
                      <span
                        className={`grid size-9 shrink-0 place-items-center rounded-xl ${
                          provider.test
                            ? "bg-amber-50 text-amber-600"
                            : "bg-brand-soft/70 text-brand-dark"
                        }`}
                      >
                        <Icon size={16} strokeWidth={1.7} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-[12.5px] font-semibold">
                          {provider.label}
                          {provider.test && (
                            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-700">
                              тест
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">
                          {provider.hint}
                        </span>
                      </span>
                      {isBusy ? (
                        <Loader2 size={15} className="shrink-0 animate-spin text-muted" />
                      ) : (
                        <Send size={13} className="shrink-0 text-muted" />
                      )}
                    </button>
                  );
                })}
              </div>

              {error && (
                <p className="mt-3 rounded-xl border border-rose/20 bg-rose/5 px-3.5 py-2.5 text-[12px] text-rose">
                  {error}
                </p>
              )}

              <p className="mt-3 text-center text-[10.5px] leading-relaxed text-muted">
                Онлайн-платёж включает тариф автоматически на {selectedMonths * 30} дней. При продлении срок
                добавляется к текущему оплаченному периоду.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
