export type PlanId = "TRIAL" | "START" | "PRO" | "BUSINESS";

export const TRIAL_DAYS = 14;
export const SUBSCRIPTION_PERIOD_DAYS = 30;
export const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;
export const SUBSCRIPTION_PERIOD_MS = SUBSCRIPTION_PERIOD_DAYS * 24 * 60 * 60 * 1000;

export type Plan = {
  id: PlanId;
  name: string;
  priceUzs: number;
  period: string;
  tagline: string;
  staffLimit: number;
  serviceLimit: number;
  storageMb: number;
  features: string[];
  highlighted?: boolean;
};

export const PLANS: Plan[] = [
  {
    id: "TRIAL",
    name: "Пробный",
    priceUzs: 0,
    period: "14 дней",
    tagline: "Проверить всё на своём бизнесе",
    staffLimit: 2,
    serviceLimit: 10,
    storageMb: 200,
    features: [
      "Страница записи и ссылка",
      "До 2 мастеров",
      "Таймлайн записей",
      "Запись без логина для клиента",
    ],
  },
  {
    id: "START",
    name: "Старт",
    priceUzs: 99_000,
    period: "в месяц",
    tagline: "Для мастера, который работает один",
    staffLimit: 1,
    serviceLimit: 30,
    storageMb: 500,
    features: [
      "Всё из пробного",
      "Свой адрес страницы",
      "Онлайн-запись 24/7",
      "Перенос и отмена по ссылке",
    ],
  },
  {
    id: "PRO",
    name: "Про",
    priceUzs: 199_000,
    period: "в месяц",
    tagline: "Для салона с командой",
    staffLimit: 8,
    serviceLimit: 200,
    storageMb: 2_000,
    features: [
      "Всё из «Старт»",
      "До 8 мастеров",
      "Графики, перерывы, выходные",
      "Аналитика загрузки",
      "Приоритетная поддержка",
    ],
    highlighted: true,
  },
  {
    id: "BUSINESS",
    name: "Бизнес",
    priceUzs: 399_000,
    period: "в месяц",
    tagline: "Сеть и несколько точек",
    staffLimit: 30,
    serviceLimit: 1_000,
    storageMb: 10_000,
    features: [
      "Всё из «Про»",
      "До 30 мастеров",
      "Несколько филиалов",
      "Выгрузка клиентской базы",
      "Личный менеджер",
    ],
  },
];

export function planById(id: PlanId): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

export type BillingPeriodMonths = 1 | 3 | 6 | 12;

export type BillingPeriodOption = {
  months: BillingPeriodMonths;
  label: string;
  discountPercent: number;
  badge?: string;
};

export const BILLING_PERIODS: BillingPeriodOption[] = [
  { months: 1, label: "1 месяц", discountPercent: 0 },
  { months: 3, label: "3 месяца", discountPercent: 10, badge: "-10%" },
  { months: 6, label: "6 месяцев", discountPercent: 15, badge: "-15%" },
  { months: 12, label: "12 месяцев (1 год)", discountPercent: 25, badge: "-25%" },
];

export function calculatePlanPrice({
  baseMonthlyPrice,
  months,
  customDiscountPercent = 0,
}: {
  baseMonthlyPrice: number;
  months: BillingPeriodMonths;
  customDiscountPercent?: number | null;
}) {
  const periodOption = BILLING_PERIODS.find((p) => p.months === months) ?? BILLING_PERIODS[0];
  const combinedDiscount = Math.min(
    90,
    Math.max(0, periodOption.discountPercent + (customDiscountPercent ?? 0)),
  );
  const rawTotal = baseMonthlyPrice * months;
  const totalAmountUzs = Math.round(rawTotal * (1 - combinedDiscount / 100));
  const savingsUzs = Math.max(0, rawTotal - totalAmountUzs);
  const pricePerMonthUzs = Math.round(totalAmountUzs / months);

  return {
    months,
    monthlyPrice: baseMonthlyPrice,
    rawTotal,
    discountPercent: combinedDiscount,
    totalAmountUzs,
    savingsUzs,
    pricePerMonthUzs,
  };
}

export function formatMoney(amount: number, currency = "UZS"): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
