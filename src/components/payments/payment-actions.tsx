"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Loader2, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { confirmDemoPaymentAction } from "@/server/actions/payments";
import { useTelegramWebApp } from "@/components/telegram/telegram-webapp-provider";

export function PaymentActions({
  externalId,
  provider,
  checkoutUrl,
  testMode,
}: {
  externalId: string;
  provider: string;
  checkoutUrl?: string | null;
  testMode: boolean;
}) {
  const router = useRouter();
  const { isAvailable, openInvoice, haptic } = useTelegramWebApp();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const handleOpenStars = () => {
    if (!checkoutUrl) return;
    if (isAvailable && provider === "TELEGRAM_STARS") {
      openInvoice(checkoutUrl, (status) => {
        if (status === "paid") {
          haptic.success();
          router.refresh();
        } else if (status === "failed") {
          haptic.error();
          setError("Оплата в Telegram Stars не удалась.");
        }
      });
    } else {
      window.open(checkoutUrl, "_blank");
    }
  };

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [router]);

  function confirmDemo() {
    setError(null);
    startTransition(async () => {
      const result = await confirmDemoPaymentAction(externalId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function refresh() {
    setChecking(true);
    router.refresh();
    setTimeout(() => setChecking(false), 900);
  }

  return (
    <div className="space-y-3">
      {testMode && (
        <div className="rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-[12px] leading-relaxed text-amber-900">
          <p className="font-semibold">Тестовый режим</p>
          <p className="mt-0.5">
            Реальные деньги не списываются. Платёж сразу активирует тариф — так можно
            проверить весь цикл оплаты.
          </p>
        </div>
      )}

      {provider === "DEMO" ? (
        <button
          type="button"
          onClick={confirmDemo}
          disabled={pending}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink px-5 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ShieldCheck className="size-4" />
          )}
          {pending ? "Активируем тариф…" : "Оплатить (тест)"}
        </button>
      ) : provider === "TELEGRAM_STARS" ? (
        <button
          type="button"
          onClick={handleOpenStars}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#007aff] px-5 text-[13px] font-semibold text-white transition hover:opacity-90 shadow-sm"
        >
          <Sparkles className="size-4" />
          {isAvailable ? "Оплатить Telegram Stars в приложении" : "Перейти к счёту в Telegram"}
        </button>
      ) : checkoutUrl ? (
        <a
          href={checkoutUrl}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink px-5 text-[13px] font-semibold text-white transition hover:opacity-90"
        >
          Перейти к оплате
          <ArrowUpRight className="size-4" />
        </a>
      ) : (
        <p className="rounded-2xl bg-paper px-4 py-3 text-[12px] text-muted">
          Ссылка на оплату не сохранилась. Создайте новый платёж в разделе «Оплата».
        </p>
      )}

      <button
        type="button"
        onClick={refresh}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-[12px] font-medium ring-1 ring-line transition hover:bg-paper"
      >
        <RefreshCw className={`size-3.5 ${checking ? "animate-spin" : ""}`} />
        Я оплатил — обновить статус
      </button>

      <p className="text-center text-[11px] leading-relaxed text-muted">
        Страница обновляется автоматически. Можно закрыть её — тариф включится сам,
        как только банк подтвердит платёж.
      </p>

      {error && (
        <p className="rounded-xl border border-rose/20 bg-rose/5 px-3.5 py-2.5 text-[12px] text-rose">
          {error}
        </p>
      )}
    </div>
  );
}
