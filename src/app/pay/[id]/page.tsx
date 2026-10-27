import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { planById, formatMoney } from "@/lib/plans";
import {
  demoPaymentsEnabled,
  providerLabel,
} from "@/server/payments/config";
import {
  getActiveSubscription,
  getPaymentByExternalId,
} from "@/server/payments/service";
import { PaymentActions } from "@/components/payments/payment-actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Оплата тарифа",
  robots: { index: false, follow: false },
};

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default async function PaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await getPaymentByExternalId(id);
  if (!row) notFound();

  const { payment, business } = row;
  const plan = planById(payment.plan);
  const subscription = payment.status === "PAID" ? await getActiveSubscription(business.id) : null;
  const payload = (payment.payload ?? {}) as Record<string, unknown>;
  const checkoutUrl =
    typeof payload.checkoutUrl === "string"
      ? payload.checkoutUrl
      : typeof payload.invoiceUrl === "string"
        ? payload.invoiceUrl
        : null;

  const isPaid = payment.status === "PAID";
  const isFailed = payment.status === "FAILED";
  const isCancelled = payment.status === "CANCELLED";
  const pendingPayment = !isPaid && !isFailed && !isCancelled;

  return (
    <main className="min-h-screen bg-paper px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-lg">
        <Link
          href="/"
          className="mx-auto flex w-fit items-center gap-2 text-[15px] font-semibold tracking-[-0.02em]"
        >
          <span className="grid size-7 place-items-center rounded-[10px] bg-ink text-[12px] font-bold text-white">
            u
          </span>
          uzbook
        </Link>

        <div className="mt-6 overflow-hidden rounded-[26px] bg-white ring-1 ring-line/80">
          <div className="border-b border-line/70 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">
                  {isPaid
                    ? "Оплачено"
                    : isFailed
                      ? "Платёж не прошёл"
                      : isCancelled
                        ? "Платёж отменён"
                        : "Ожидает оплаты"}
                </p>
                <h1 className="mt-1.5 text-[24px] leading-tight font-semibold tracking-[-0.03em]">
                  Тариф «{plan.name}»
                </h1>
                <p className="mt-1 text-[12.5px] text-muted">{business.name} · 30 дней</p>
              </div>
              <span
                className={`grid size-11 shrink-0 place-items-center rounded-2xl ${
                  isPaid
                    ? "bg-emerald-50 text-emerald-600"
                    : isFailed || isCancelled
                      ? "bg-rose/10 text-rose"
                      : "bg-amber-50 text-amber-600"
                }`}
              >
                {isPaid ? (
                  <CheckCircle2 className="size-5" />
                ) : isFailed || isCancelled ? (
                  <XCircle className="size-5" />
                ) : (
                  <Clock3 className="size-5" />
                )}
              </span>
            </div>
          </div>

          <div className="px-6 py-5">
            <div className="flex items-center justify-between rounded-2xl bg-paper/80 px-4 py-3.5">
              <span className="text-[12.5px] text-muted">Сумма</span>
              <span className="text-[17px] font-semibold tracking-[-0.02em]">
                {formatMoney(payment.amount, payment.currency)}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between px-1 text-[12px] text-muted">
              <span>Способ оплаты</span>
              <span className="font-medium text-ink">{providerLabel(payment.provider)}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between px-1 text-[12px] text-muted">
              <span>Номер заказа</span>
              <span className="font-mono text-[10.5px]">{payment.externalId.slice(0, 8)}</span>
            </div>

            <div className="mt-5">
              {isPaid ? (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-emerald-50 px-4 py-3.5 text-[12.5px] leading-relaxed text-emerald-900">
                    Тариф активен до{" "}
                    <span className="font-semibold">
                      {formatDate(subscription?.currentPeriodEnd ?? null)}
                    </span>
                    <br />
                    Лимиты мастеров, услуг и хранилища уже обновлены.
                  </div>
                  <Link
                    href="/dashboard"
                    className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-ink px-5 text-[13px] font-semibold text-white transition hover:opacity-90"
                  >
                    Перейти в кабинет
                  </Link>
                </div>
              ) : pendingPayment ? (
                <PaymentActions
                  externalId={payment.externalId}
                  provider={payment.provider}
                  checkoutUrl={checkoutUrl}
                  testMode={payment.provider === "DEMO" && demoPaymentsEnabled()}
                />
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-rose/5 px-4 py-3.5 text-[12.5px] leading-relaxed text-rose">
                    {isFailed
                      ? "Банк отклонил платёж или он был отменён. Деньги не списаны."
                      : "Платёж отменён. Деньги не списаны."}
                  </div>
                  <Link
                    href="/dashboard/billing"
                    className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-ink px-5 text-[13px] font-semibold text-white transition hover:opacity-90"
                  >
                    Выбрать тариф заново
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-muted">
          Если что-то пошло не так — напишите в поддержку. Оплата защищена платёжным
          провайдером, данные карты на сайте не хранятся.
        </p>
      </div>
    </main>
  );
}
