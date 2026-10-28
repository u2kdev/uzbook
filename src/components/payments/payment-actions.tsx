"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Check, Copy, Loader2, RefreshCw, ShieldCheck, Sparkles, Coins } from "lucide-react";
import { confirmDemoPaymentAction, confirmCryptoPaymentAction } from "@/server/actions/payments";
import { useTelegramWebApp } from "@/components/telegram/telegram-webapp-provider";

export function PaymentActions({
  externalId,
  provider,
  checkoutUrl,
  testMode,
  payload,
}: {
  externalId: string;
  provider: string;
  checkoutUrl?: string | null;
  testMode: boolean;
  payload?: Record<string, unknown>;
}) {
  const router = useRouter();
  const { isAvailable, openInvoice, haptic } = useTelegramWebApp();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [copied, setCopied] = useState(false);

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

  function confirmCrypto() {
    if (!txHash.trim()) {
      setError("Введите хеш транзакции (TXID)");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await confirmCryptoPaymentAction(externalId, txHash.trim());
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
      ) : provider === "CRYPTO" ? (
        <div className="space-y-3 rounded-2xl bg-paper p-4 ring-1 ring-line/80">
          <div className="flex items-center gap-2 text-[13px] font-semibold">
            <Coins className="size-4 text-amber" />
            <span>Перевод {String(payload?.asset ?? "USDT")} ({String(payload?.network ?? "TRC-20")})</span>
          </div>

          <div className="rounded-xl bg-white p-3 border border-line text-[12px]">
            <p className="text-[11px] text-muted">Сумма к переводу:</p>
            <p className="text-[15px] font-bold text-ink">
              {String(payload?.cryptoAmount ?? "11.60")} {String(payload?.asset ?? "USDT")}
            </p>
          </div>

          <div className="rounded-xl bg-white p-3 border border-line text-[12px]">
            <p className="text-[11px] text-muted">Адрес кошелька ({String(payload?.network ?? "TRC-20")}):</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] break-all select-all">
                {String(payload?.depositAddress ?? "")}
              </span>
              <button
                type="button"
                onClick={async () => {
                  if (payload?.depositAddress) {
                    await navigator.clipboard.writeText(String(payload.depositAddress));
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }
                }}
                className="shrink-0 p-1.5 rounded-lg border border-line hover:bg-paper"
              >
                {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <label className="text-[11.5px] font-medium text-muted" htmlFor="tx-hash">
              Хеш транзакции (TXID после перевода):
            </label>
            <input
              id="tx-hash"
              className="input-base text-[12px]"
              placeholder="Вставьте хеш (TXID) из кошелька"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
            />
          </div>

          <button
            type="button"
            onClick={confirmCrypto}
            disabled={pending || !txHash.trim()}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink px-5 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            {pending ? "Проверяем транзакцию…" : "Подтвердить оплату"}
          </button>
        </div>
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
