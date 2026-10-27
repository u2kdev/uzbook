import { desc, eq } from "drizzle-orm";
import { CreditCard, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { getDb } from "@/server/db";
import { subscriptions } from "@/server/db/schema";
import { getMyBusiness } from "@/server/auth/session";
import { BillingPlans } from "@/components/dashboard/billing-plans";
import { formatMoney, planById } from "@/lib/plans";
import { formatStorage, getSubscriptionInfo, getUsage, MB } from "@/server/limits";
import { availableProviders, providerLabel } from "@/server/payments/config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Тариф и оплата" };

function storagePlanLabel(mb: number): string {
  return mb >= 1000 ? `${mb / 1000} ГБ` : `${mb} МБ`;
}

function percent(value: number, limit: number): number {
  if (limit <= 0) return 100;
  return Math.min(100, Math.round((value / limit) * 100));
}

export default async function BillingPage() {
  const { business } = await getMyBusiness();
  if (!business) return null;

  const db = await getDb();
  const history = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.businessId, business.id))
    .orderBy(desc(subscriptions.createdAt))
    .limit(10);

  const current = planById(business.plan);
  const pending = history.find((row) => row.status === "PENDING") ?? null;
  const providers = availableProviders();
  const usage = await getUsage(business);
  const subscription = await getSubscriptionInfo(business);
  const payDetails =
    process.env.PAYMENT_DETAILS ??
    "Перевод на карту: 8600 0000 0000 0000 (Uzcard) · Получатель: UZBOOK";
  const supportTelegram = process.env.SUPPORT_TELEGRAM ?? "@uzbook_support";
  const trialDaysLeft = subscription.trialDaysLeft;
  const storageLimitBytes = current.storageMb * MB;
  const paidUntil = subscription.periodEnd
    ? new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(subscription.periodEnd)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">
          Подписка
        </p>
        <h1 className="mt-1.5 text-[26px] leading-tight font-semibold tracking-[-0.03em]">
          Тариф и оплата
        </h1>
        <p className="mt-1 text-[12.5px] text-muted">
          Один тариф на бизнес: страница записи, мастера, услуги и уведомления.
        </p>
      </div>

      {subscription.trialExpired && (
        <div className="rounded-2xl border border-rose/25 bg-rose/5 px-4 py-3.5 text-[12.5px] leading-relaxed text-rose">
          Пробный период закончился. Услуги и записи продолжают работать, но создать новых
          мастеров, услуги и фото нельзя — подключите тариф.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[20px] bg-white p-5 ring-1 ring-line/80">
          <p className="text-[11.5px] text-muted">Текущий тариф</p>
          <p className="mt-1.5 text-[20px] font-semibold tracking-[-0.02em]">{current.name}</p>
          <p className="mt-1 text-[11.5px] text-muted">
            {business.plan === "TRIAL"
              ? trialDaysLeft != null
                ? `Пробный период · осталось ${trialDaysLeft} дн.`
                : "Пробный период"
              : paidUntil
                ? `Оплачен до ${paidUntil}`
                : `${formatMoney(current.priceUzs, business.currency)} / мес`}
          </p>
        </div>

        {[
          {
            label: "Мастера",
            value: `${usage.staff} из ${current.staffLimit}`,
            pct: percent(usage.staff, current.staffLimit),
            hint: "лимит тарифа",
          },
          {
            label: "Услуги",
            value: `${usage.services} из ${current.serviceLimit}`,
            pct: percent(usage.services, current.serviceLimit),
            hint: "лимит тарифа",
          },
          {
            label: "Хранилище",
            value: `${formatStorage(usage.storageBytes)} из ${storagePlanLabel(current.storageMb)}`,
            pct: percent(usage.storageBytes, storageLimitBytes),
            hint: "фото и обложки",
          },
        ].map((card) => (
          <div key={card.label} className="rounded-[20px] bg-white p-5 ring-1 ring-line/80">
            <p className="text-[11.5px] text-muted">{card.label}</p>
            <p className="mt-1.5 text-[17px] font-semibold tracking-[-0.02em]">{card.value}</p>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-paper">
              <div
                className={`h-full rounded-full ${
                  card.pct >= 100 ? "bg-rose" : card.pct >= 80 ? "bg-amber" : "bg-ink"
                }`}
                style={{ width: `${Math.max(3, card.pct)}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-muted">{card.hint}</p>
          </div>
        ))}
      </div>

      {pending && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber/25 bg-amber/5 px-4 py-3.5">
          <Sparkles size={16} strokeWidth={1.7} className="text-amber" />
          <p className="flex-1 text-[12.5px] text-ink-soft">
            Заявка на тариф <b>{planById(pending.plan).name}</b> отправлена. Мы свяжемся с вами
            для подтверждения оплаты — обычно в течение рабочего дня.
          </p>
        </div>
      )}

      <div className="rounded-[24px] bg-white p-5 ring-1 ring-line/80">
        <div className="flex flex-wrap items-center gap-2">
          <Zap size={16} strokeWidth={1.7} className="text-brand" />
          <h2 className="text-[14px] font-semibold">Онлайн-оплата</h2>
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand-dark">
            автоматически
          </span>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            {
              step: "1",
              title: "Выберите тариф",
              text: "Нажмите «Подключить» на подходящем тарифе ниже.",
            },
            {
              step: "2",
              title: "Оплатите",
              text: "Payme, Click, Telegram Stars или тестовый платёж — на выбор.",
            },
            {
              step: "3",
              title: "Тариф включится сразу",
              text: "Без ожидания и переписки. Лимиты обновятся автоматически.",
            },
          ].map((item) => (
            <div key={item.step} className="rounded-2xl bg-paper/70 p-4">
              <span className="grid size-7 place-items-center rounded-full bg-ink text-[11px] font-semibold text-white">
                {item.step}
              </span>
              <p className="mt-2.5 text-[12.5px] font-semibold">{item.title}</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{item.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl bg-paper/80 px-3.5 py-3 text-[11.5px] leading-relaxed text-muted">
          <p className="font-medium text-ink-soft">Если удобнее переводом</p>
          <p className="mt-1">{payDetails}</p>
          <p className="mt-1">
            После перевода напишите в поддержку {supportTelegram} и приложите чек. Заявку
            подтвердит администратор — тариф включится на 30 дней.
          </p>
        </div>
      </div>

      <BillingPlans
        currentPlan={business.plan}
        pendingPlan={pending?.plan ?? null}
        pendingId={pending?.id ?? null}
        currency={business.currency}
        providers={providers}
      />

      <div className="rounded-[24px] bg-white p-5 ring-1 ring-line/80">
        <div className="flex items-center gap-2">
          <CreditCard size={16} strokeWidth={1.6} className="text-muted" />
          <h2 className="text-[14px] font-semibold">История подписок</h2>
        </div>

        {history.length === 0 ? (
          <p className="mt-3 text-[12.5px] text-muted">Пока нет платежей.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-line/80">
            {history.map((row, index) => (
              <div
                key={row.id}
                className={`flex flex-wrap items-center gap-3 px-3.5 py-3 text-[12px] ${
                  index > 0 ? "border-t border-line/70" : ""
                }`}
              >
                <span className="w-20 font-semibold">{planById(row.plan).name}</span>
                <span className="text-muted">
                  {new Intl.DateTimeFormat("ru-RU", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  }).format(row.createdAt)}
                </span>
                <span className="text-[11px] text-muted">{providerLabel(row.provider)}</span>
                <span className="ml-auto font-medium tabular-nums">
                  {row.amount > 0 ? formatMoney(row.amount, row.currency) : "—"}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                    row.status === "ACTIVE" || row.status === "TRIAL"
                      ? "bg-mint/10 text-mint"
                      : row.status === "PENDING"
                        ? "bg-amber/10 text-amber"
                        : row.status === "PAST_DUE"
                          ? "bg-rose/10 text-rose"
                          : "bg-paper text-muted"
                  }`}
                >
                  {{
                    TRIAL: "Пробный",
                    PENDING: "Заявка",
                    ACTIVE: "Активен",
                    PAST_DUE: "Просрочен",
                    CANCELLED: "Завершён",
                  }[row.status] ?? row.status}
                </span>
              </div>
            ))}
          </div>
        )}

        <p className="mt-4 flex items-start gap-2 text-[11.5px] leading-relaxed text-muted">
          <ShieldCheck size={14} strokeWidth={1.6} className="mt-0.5 shrink-0 text-mint" />
          Онлайн-платежи подтверждаются автоматически и активируют тариф на 30 дней. При
          продлении оплаченный период добавляется к текущему. Ручные заявки подтверждает
          администратор платформы.
        </p>
      </div>
    </div>
  );
}
