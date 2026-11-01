import type { Plan } from "@/lib/plans";

export type PaymentProviderId = "PAYME" | "CLICK" | "DEMO" | "MANUAL" | "CRYPTO";

export type ProviderOption = {
  id: PaymentProviderId;
  label: string;
  hint: string;
  test?: boolean;
};

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function paymeConfig() {
  const merchantId = process.env.PAYME_MERCHANT_ID?.trim() ?? "";
  const key = process.env.PAYME_KEY?.trim() ?? "";
  return {
    merchantId,
    key,
    enabled: Boolean(merchantId && key),
  };
}

export function clickConfig() {
  const serviceId = process.env.CLICK_SERVICE_ID?.trim() ?? "";
  const merchantId = process.env.CLICK_MERCHANT_ID?.trim() ?? "";
  const secretKey = process.env.CLICK_SECRET_KEY?.trim() ?? "";
  return {
    serviceId,
    merchantId,
    secretKey,
    enabled: Boolean(serviceId && merchantId && secretKey),
  };
}

/**
 * Test payments activate a plan for free. They require an explicit
 * `PAYMENTS_DEMO=on` flag and are blocked in production unless
 * `ALLOW_PRODUCTION_DEMO_PAYMENTS=on` is also set.
 */
export function demoPaymentsEnabled(): boolean {
  const flag = process.env.PAYMENTS_DEMO?.trim().toLowerCase() ?? "";
  if (!["on", "true", "1", "yes"].includes(flag)) return false;
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_PRODUCTION_DEMO_PAYMENTS?.trim().toLowerCase() !== "on"
  ) {
    return false;
  }
  return true;
}

export function cryptoPaymentsEnabled(): boolean {
  const flag = process.env.PAYMENTS_CRYPTO?.trim().toLowerCase();
  if (["off", "false", "0", "no"].includes(flag ?? "")) return false;
  return Boolean(process.env.CRYPTO_DEPOSIT_ADDRESS?.trim());
}

export function cryptoDepositConfig() {
  const address = process.env.CRYPTO_DEPOSIT_ADDRESS?.trim() ?? "";
  const network = process.env.CRYPTO_NETWORK?.trim() || "TRC-20 (TRON)";
  const asset = process.env.CRYPTO_ASSET?.trim() || "USDT";
  const rateRaw = Number(process.env.CRYPTO_UZS_PER_USD);
  const rateUzs = Number.isFinite(rateRaw) && rateRaw > 0 ? rateRaw : 12850;
  return { address, network, asset, rateUzs };
}

export function availableProviders(): ProviderOption[] {
  const providers: ProviderOption[] = [];

  if (paymeConfig().enabled) {
    providers.push({
      id: "PAYME",
      label: "Payme",
      hint: "Карта Uzcard / Humo, оплата на защищённой странице Payme",
    });
  }
  if (clickConfig().enabled) {
    providers.push({
      id: "CLICK",
      label: "Click",
      hint: "Оплата картой или через приложение Click",
    });
  }
  if (cryptoPaymentsEnabled()) {
    providers.push({
      id: "CRYPTO",
      label: "Криптовалюта (USDT)",
      hint: "Оплата в USDT (TRC-20 / TON) по текущему курсу",
    });
  }
  if (demoPaymentsEnabled()) {
    providers.push({
      id: "DEMO",
      label: "Тестовый платёж",
      hint: "Мгновенно включает тариф. Реальные деньги не списываются",
      test: true,
    });
  }
  providers.push({
    id: "MANUAL",
    label: "Перевод вручную",
    hint: "Переведите сумму и пришлите чек — админ подтвердит вручную",
  });

  return providers;
}

export function providerLabel(provider: string): string {
  return {
    PAYME: "Payme",
    CLICK: "Click",
    TELEGRAM_STARS: "Telegram Stars",
    DEMO: "Тестовый платёж",
    MANUAL: "Перевод вручную",
    CRYPTO: "Криптовалюта",
  }[provider] ?? provider;
}

/** Payme checkout expects the amount in tiyin (1 UZS = 100 tiyin). */
export function buildPaymeCheckoutUrl(
  plan: Plan,
  externalId: string,
  customAmountUzs?: number | null,
): string | null {
  const { merchantId, enabled } = paymeConfig();
  if (!enabled) return null;

  const amountUzs =
    customAmountUzs !== null && customAmountUzs !== undefined && customAmountUzs > 0
      ? customAmountUzs
      : plan.priceUzs;

  const params = [
    `m=${merchantId}`,
    `ac.order_id=${externalId}`,
    `a=${amountUzs * 100}`,
    `c=${appUrl()}/pay/${externalId}`,
    "l=ru",
  ].join(";");

  return `https://checkout.paycom.uz/${Buffer.from(params).toString("base64")}`;
}

export function buildClickCheckoutUrl(
  plan: Plan,
  externalId: string,
  customAmountUzs?: number | null,
): string | null {
  const { serviceId, merchantId, enabled } = clickConfig();
  if (!enabled) return null;

  const amountUzs =
    customAmountUzs !== null && customAmountUzs !== undefined && customAmountUzs > 0
      ? customAmountUzs
      : plan.priceUzs;

  const url = new URL("https://my.click.uz/services/pay");
  url.searchParams.set("service_id", serviceId);
  url.searchParams.set("merchant_id", merchantId);
  url.searchParams.set("amount", String(amountUzs));
  url.searchParams.set("transaction_param", externalId);
  url.searchParams.set("return_url", `${appUrl()}/pay/${externalId}`);
  return url.toString();
}
