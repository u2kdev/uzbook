"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronRight,
  CreditCard,
  FlaskConical,
  Landmark,
  Loader2,
  Send,
  Star,
  X,
} from "lucide-react";
import {
  cancelPlanRequestAction,
  requestPlanAction,
} from "@/server/actions/profile";
import { startPaymentAction, type PaymentActionState } from "@/server/actions/payments";
import { PLANS, formatMoney, type PlanId } from "@/lib/plans";

type ProviderId = "PAYME" | "CLICK" | "TELEGRAM_STARS" | "DEMO" | "MANUAL";

type Provider = {
  id: ProviderId;
  label: string;
  hint: string;
  test?: boolean;
};

const PROVIDER_ICONS: Record<ProviderId, typeof CreditCard> = {
  PAYME: CreditCard,
  CLICK: CreditCard,
  TELEGRAM_STARS: Star,
  DEMO: FlaskConical,
  MANUAL: Landmark,
};

export function BillingPlans({
  currentPlan,
  pendingPlan,
  pendingId,
  currency,
  providers,
}: {
  currentPlan: PlanId;
  pendingPlan: PlanId | null;
  pendingId: string | null;
  currency: string;
  providers: Provider[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<PlanId | null>(null);
  const [busyProvider, setBusyProvider] = useState<ProviderId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cancelling, startCancel] = useTransition();
  const [pending, startTransition] = useTransition();

  const selectedPlan = selected ? PLANS.find((plan) => plan.id === selected) ?? null : null;

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
        const result = await requestPlanAction(null, formData);
        setBusyProvider(null);
        if (result?.error) {
          setError(result.error);
          return;
        }
        setSelected(null);
        setNotice("Заявка отправлена. Администратор подтвердит оплату и включит тариф.");
        router.refresh();
      });
      return;
    }

    setBusyProvider(provider.id);
    startTransition(async () => {
      const result: PaymentActionState = await startPaymentAction(
        selected,
        provider.id as Exclude<ProviderId, "MANUAL">,
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

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const isPending = plan.id === pendingPlan;

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

                <div className="mt-4 flex items-end gap-1.5">
                  <span className="text-[24px] leading-none font-semibold tracking-tight">
                    {plan.priceUzs === 0 ? "0" : formatMoney(plan.priceUzs, currency)}
                  </span>
                  <span
                    className={`pb-0.5 text-[11px] ${
                      plan.highlighted ? "text-white/50" : "text-muted"
                    }`}
                  >
                    {plan.period}
                  </span>
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

      {selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-3 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md overflow-hidden rounded-[26px] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-line/70 px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
                  Оплата тарифа
                </p>
                <h3 className="mt-1 text-[19px] font-semibold tracking-[-0.02em]">
                  {selectedPlan.name} · {formatMoney(selectedPlan.priceUzs, currency)}
                </h3>
                <p className="mt-0.5 text-[11.5px] text-muted">Доступ на 30 дней</p>
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
                Онлайн-платёж включает тариф автоматически. При продлении 30 дней
                добавятся к текущему оплаченному периоду.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
