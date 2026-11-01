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

export function formatMoney(amount: number, currency = "UZS"): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
