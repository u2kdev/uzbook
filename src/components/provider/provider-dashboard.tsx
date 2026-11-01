"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CalendarClock,
  Check,
  CreditCard,
  ExternalLink,
  LogOut,
  Percent,
  Plus,
  Settings2,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { logoutAction } from "@/app/(auth)/actions";
import {
  providerConnectClientAction,
  providerCustomizeSubscriptionAction,
  providerUpdateCardAction,
  type ProviderActionState,
} from "@/server/actions/providers";
import { formatMoney } from "@/lib/plans";

export type ProviderClientItem = {
  businessId: string;
  businessName: string;
  businessSlug: string;
  category: string;
  city: string | null;
  status: string;
  plan: string;
  trialEndsAt: string | null;
  customStaffLimit: number | null;
  customClientLimit: number | null;
  customPriceUzs: number | null;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string | null;
  staffCount: number;
  clientsCount: number;
  subscriptionStatus: string | null;
  subscriptionAmount: number | null;
  providerPayoutAmount: number | null;
  createdAt: string;
};

export function ProviderDashboard({
  provider,
  clients,
  stats,
}: {
  provider: {
    id: string;
    name: string;
    email: string;
    username: string | null;
    phone: string | null;
    role?: string;
    commissionPercent: number;
    payoutCard: string | null;
  };
  clients: ProviderClientItem[];
  stats: {
    connectedCount: number;
    commissionPercent: number;
    totalGrossPaid: number;
    totalEarnedCard: number;
    expectedFromPending: number;
  };
}) {
  const [showConnectForm, setShowConnectForm] = useState(clients.length === 0);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);

  // Live calculator state for connecting a new client
  const [staffLimit, setStaffLimit] = useState(5);
  const [clientLimit, setClientLimit] = useState(500);
  const [trialDays, setTrialDays] = useState(14);
  const [customPrice, setCustomPrice] = useState(199000);
  const [sendPaymentNow, setSendPaymentNow] = useState(true);

  const [connectState, connectAction, connectPending] = useActionState<
    ProviderActionState,
    FormData
  >(providerConnectClientAction, null);

  const [customizeState, customizeAction, customizePending] = useActionState<
    ProviderActionState,
    FormData
  >(providerCustomizeSubscriptionAction, null);

  const [cardState, cardAction, cardPending] = useActionState<ProviderActionState, FormData>(
    providerUpdateCardAction,
    null,
  );

  const calculatedShare = Math.round((customPrice * provider.commissionPercent) / 100);

  return (
    <div className="min-h-dvh bg-paper pb-16">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase">
              Provider · {provider.commissionPercent}%
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-[12.5px] font-semibold">{provider.name}</p>
              <p className="text-[11px] text-muted">
                Никнейм: <b>{provider.username || provider.email}</b>
              </p>
            </div>
            {provider.role === "ADMIN" && (
              <Link href="/admin" className="btn btn-ghost h-9 px-3 text-[12px]">
                В Админку
              </Link>
            )}
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-[12px] font-medium text-ink hover:bg-paper"
              >
                <LogOut size={14} /> Выйти
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 pt-6 sm:px-6 sm:pt-8">
        {/* Welcome & Personal Card Row */}
        <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-[24px] border border-line bg-white p-5 sm:p-6">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-brand uppercase">
              Личный кабинет провайдера
            </p>
            <h1 className="mt-1.5 text-[24px] sm:text-[28px] font-semibold tracking-[-0.03em]">
              Здравствуйте, {provider.name}
            </h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
              Подключайте новых клиентов (салоны и мастеров), настраивайте им индивидуальные
              условия подписки (количество людей, сотрудников, 14–30 дней бесплатно и свою цену).
              Оплата поступает владельцу платформы, а вам начисляется{" "}
              <b className="text-ink">{provider.commissionPercent}%</b> на личную карту.
            </p>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => setShowConnectForm((v) => !v)}
                className="btn btn-primary h-11 gap-2 px-5 text-[13px]"
              >
                <Plus size={16} />
                {showConnectForm ? "Скрыть форму подключения" : "Подключить нового клиента (салон)"}
              </button>
            </div>
          </div>

          {/* Personal Payout Card Widget */}
          <div className="rounded-[24px] border border-line bg-white p-5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink">
                <CreditCard size={15} className="text-brand" /> Ваша карта для выплат (
                {provider.commissionPercent}%)
              </span>
              <span className="rounded-full bg-mint/10 px-2 py-0.5 text-[10.5px] font-semibold text-mint">
                Ставка {provider.commissionPercent}%
              </span>
            </div>

            <form action={cardAction} className="mt-3 space-y-2.5">
              <input
                name="payoutCard"
                type="text"
                defaultValue={provider.payoutCard ?? ""}
                placeholder="8600 / 9860 •••• •••• ••••"
                className="input-base h-10 text-[13px]"
              />
              <button
                type="submit"
                disabled={cardPending}
                className="btn btn-secondary h-9 w-full text-[12px]"
              >
                {cardPending ? "Сохраняем..." : "Сохранить номер карты"}
              </button>
              {cardState?.message && (
                <p className="text-[11.5px] font-medium text-mint">{cardState.message}</p>
              )}
            </form>
          </div>
        </div>

        {/* Financial KPI Cards */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-line bg-white p-4">
            <div className="flex items-center justify-between text-muted">
              <span className="text-[11.5px] font-medium">Подключено клиентов</span>
              <Building2 size={16} />
            </div>
            <p className="mt-2 text-[24px] font-semibold">{stats.connectedCount}</p>
            <p className="mt-1 text-[11px] text-muted">активных салонов и студий</p>
          </div>

          <div className="rounded-2xl border border-line bg-white p-4">
            <div className="flex items-center justify-between text-muted">
              <span className="text-[11.5px] font-medium">Ваша ставка комиссии</span>
              <Percent size={16} />
            </div>
            <p className="mt-2 text-[24px] font-semibold text-brand">
              {stats.commissionPercent}%
            </p>
            <p className="mt-1 text-[11px] text-muted">переводится на вашу личную карту</p>
          </div>

          <div className="rounded-2xl border border-line bg-white p-4">
            <div className="flex items-center justify-between text-muted">
              <span className="text-[11.5px] font-medium">Начислено вам на карту</span>
              <Wallet size={16} className="text-mint" />
            </div>
            <p className="mt-2 text-[24px] font-semibold text-mint">
              {formatMoney(stats.totalEarnedCard)}
            </p>
            <p className="mt-1 text-[11px] text-muted">
              из {formatMoney(stats.totalGrossPaid)} оплаченных подписок
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-white p-4">
            <div className="flex items-center justify-between text-muted">
              <span className="text-[11.5px] font-medium">Ожидает подтверждения</span>
              <CalendarClock size={16} className="text-amber" />
            </div>
            <p className="mt-2 text-[24px] font-semibold">
              {formatMoney(stats.expectedFromPending)}
            </p>
            <p className="mt-1 text-[11px] text-muted">ваша доля по активным заявкам</p>
          </div>
        </div>

        {/* CONNECT NEW CLIENT & CUSTOMIZE SUBSCRIPTION FORM */}
        {showConnectForm && (
          <div className="rounded-[26px] border-2 border-brand/30 bg-white p-5 shadow-soft sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-4">
              <div>
                <span className="badge">
                  <Sparkles size={12} /> Новое подключение
                </span>
                <h2 className="mt-1.5 text-[19px] font-semibold">
                  Подключить клиента (салон) и кастомизировать подписку
                </h2>
                <p className="text-[12.5px] text-muted">
                  Создайте кабинет для владельца салона и настройте индивидуальные лимиты и цену.
                </p>
              </div>
            </div>

            <form action={connectAction} className="mt-5 space-y-6">
              {/* Block 1: Client & Salon Info */}
              <div>
                <h3 className="mb-3 text-[13.5px] font-semibold text-ink uppercase tracking-wider">
                  1. Данные владельца и салона
                </h3>
                <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="label-base">Имя владельца салона *</label>
                    <input
                      name="ownerName"
                      required
                      placeholder="Дилноза Каримова"
                      className="input-base"
                    />
                  </div>
                  <div>
                    <label className="label-base">Email владельца (для входа) *</label>
                    <input
                      name="ownerEmail"
                      type="email"
                      required
                      placeholder="owner@salon.uz"
                      className="input-base"
                    />
                  </div>
                  <div>
                    <label className="label-base">Пароль для владельца *</label>
                    <input
                      name="ownerPassword"
                      type="text"
                      required
                      minLength={6}
                      placeholder="Минимум 6 символов"
                      className="input-base"
                    />
                  </div>
                  <div>
                    <label className="label-base">Телефон владельца (для связи и входа) *</label>
                    <input
                      name="ownerPhone"
                      type="tel"
                      required
                      placeholder="+998 90 123 45 67"
                      className="input-base"
                    />
                  </div>
                </div>

                <div className="mt-3.5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="label-base">Название салона / студии *</label>
                    <input
                      name="businessName"
                      required
                      placeholder="Silk Beauty Studio"
                      className="input-base"
                    />
                  </div>
                  <div>
                    <label className="label-base">Адрес ссылки (slug)</label>
                    <input
                      name="slug"
                      placeholder="silk-beauty"
                      className="input-base"
                    />
                  </div>
                  <div>
                    <label className="label-base">Категория</label>
                    <select name="category" className="input-base">
                      <option value="beauty">Салон красоты</option>
                      <option value="barbershop">Барбершоп</option>
                      <option value="nails">Ногтевая студия</option>
                      <option value="dental">Стоматология / Клиника</option>
                      <option value="spa">SPA и Массаж</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-base">Город</label>
                    <input
                      name="city"
                      defaultValue="Ташкент"
                      className="input-base"
                    />
                  </div>
                </div>
              </div>

              {/* Block 2: Subscription Customization */}
              <div className="rounded-2xl border border-line bg-paper/60 p-4 sm:p-5">
                <h3 className="mb-3 text-[13.5px] font-semibold text-ink uppercase tracking-wider">
                  2. Кастомизация подписки (сотрудники, клиенты, 14–30 дней бесплатно, ваша цена)
                </h3>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Staff Limit */}
                  <div>
                    <label className="label-base">Количество сотрудников</label>
                    <input
                      name="customStaffLimit"
                      type="number"
                      min={1}
                      max={500}
                      value={staffLimit}
                      onChange={(e) => setStaffLimit(Number(e.target.value) || 1)}
                      className="input-base"
                    />
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {[2, 5, 10, 20, 50].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setStaffLimit(val)}
                          className={`rounded-lg border px-2 py-1 text-[11px] font-semibold ${
                            staffLimit === val
                              ? "border-brand bg-brand text-white"
                              : "border-line bg-white text-ink"
                          }`}
                        >
                          {val} сотр.
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* People / Client Limit */}
                  <div>
                    <label className="label-base">Количество людей (клиентов)</label>
                    <input
                      name="customClientLimit"
                      type="number"
                      min={10}
                      max={100000}
                      value={clientLimit}
                      onChange={(e) => setClientLimit(Number(e.target.value) || 100)}
                      className="input-base"
                    />
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {[100, 300, 500, 1000, 5000].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setClientLimit(val)}
                          className={`rounded-lg border px-2 py-1 text-[11px] font-semibold ${
                            clientLimit === val
                              ? "border-brand bg-brand text-white"
                              : "border-line bg-white text-ink"
                          }`}
                        >
                          {val} чел.
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Free Trial 14-30 days */}
                  <div>
                    <label className="label-base">Бесплатный период (14–30 дн.)</label>
                    <input
                      name="trialDays"
                      type="number"
                      min={14}
                      max={30}
                      value={trialDays}
                      onChange={(e) =>
                        setTrialDays(Math.min(30, Math.max(14, Number(e.target.value) || 14)))
                      }
                      className="input-base"
                    />
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {[14, 21, 30].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setTrialDays(val)}
                          className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                            trialDays === val
                              ? "border-brand bg-brand text-white"
                              : "border-line bg-white text-ink"
                          }`}
                        >
                          {val} дней бесплатно
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Price */}
                  <div>
                    <label className="label-base">Ваша цена подписки (UZS)</label>
                    <input
                      name="customPriceUzs"
                      type="number"
                      min={0}
                      step={1000}
                      value={customPrice}
                      onChange={(e) => setCustomPrice(Number(e.target.value) || 0)}
                      className="input-base font-semibold"
                    />
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {[99000, 150000, 199000, 299000, 399000].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setCustomPrice(val)}
                          className={`rounded-lg border px-2 py-1 text-[10.5px] font-semibold ${
                            customPrice === val
                              ? "border-brand bg-brand text-white"
                              : "border-line bg-white text-ink"
                          }`}
                        >
                          {(val / 1000).toFixed(0)}k
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Live Payout Breakdown Box */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand/25 bg-white p-4">
                  <div className="space-y-0.5">
                    <p className="text-[12px] text-muted">
                      Оплата от клиента (поступает главному владельцу платформы):{" "}
                      <b className="text-ink">{formatMoney(customPrice)}</b>
                    </p>
                    <p className="text-[13.5px] font-semibold text-mint">
                      Ваша выплата на личную карту ({provider.commissionPercent}%):{" "}
                      {formatMoney(calculatedShare)}
                    </p>
                  </div>

                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-paper px-3.5 py-2 text-[12px] font-medium">
                    <input
                      type="checkbox"
                      name="sendPaymentRequestNow"
                      value="true"
                      checked={sendPaymentNow}
                      onChange={(e) => setSendPaymentNow(e.target.checked)}
                      className="size-4 accent-brand"
                    />
                    <span>Сразу создать заявку на оплату тарифа</span>
                  </label>
                </div>
              </div>

              {connectState?.error && (
                <div className="rounded-xl border border-rose/20 bg-rose/5 px-4 py-3 text-[12.5px] text-rose">
                  {connectState.error}
                </div>
              )}
              {connectState?.ok && connectState.message && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12.5px] font-medium text-emerald-900">
                  {connectState.message}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  disabled={connectPending}
                  className="btn btn-primary h-11 px-6 text-[13px]"
                >
                  <Check size={16} />{" "}
                  {connectPending
                    ? "Подключаем клиента..."
                    : "Подключить клиента и активировать подписку"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* CONNECTED CLIENTS LIST */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[17px] font-semibold">
              Подключённые вами клиенты ({clients.length})
            </h2>
          </div>

          {customizeState?.message && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[12.5px] font-medium text-emerald-900">
              {customizeState.message}
            </div>
          )}

          {clients.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-line bg-white p-10 text-center">
              <Users size={28} className="mx-auto text-muted" />
              <p className="mt-3 text-[15px] font-semibold">Вы ещё не подключили ни одного клиента</p>
              <p className="mt-1 text-[12.5px] text-muted">
                Нажмите «Подключить нового клиента (салон)» выше, чтобы добавить первого подписчика.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {clients.map((client) => {
                const isEditing = editingClientId === client.businessId;
                const price = client.customPriceUzs ?? client.subscriptionAmount ?? 199000;
                const myShare =
                  client.providerPayoutAmount ??
                  Math.round((price * provider.commissionPercent) / 100);

                return (
                  <div
                    key={client.businessId}
                    className="rounded-[22px] border border-line bg-white p-4 sm:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-[16px] font-semibold">{client.businessName}</h3>
                          <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold text-brand-dark">
                            /{client.businessSlug}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold ${
                              client.subscriptionStatus === "ACTIVE"
                                ? "bg-mint/15 text-mint"
                                : client.subscriptionStatus === "PENDING"
                                ? "bg-amber/15 text-amber"
                                : "bg-paper text-muted"
                            }`}
                          >
                            {client.subscriptionStatus === "ACTIVE"
                              ? "Оплачен (Активен)"
                              : client.subscriptionStatus === "PENDING"
                              ? "Ожидает подтверждения оплаты"
                              : `Пробный период (до ${
                                  client.trialEndsAt
                                    ? new Date(client.trialEndsAt).toLocaleDateString("ru-RU")
                                    : "—"
                                })`}
                          </span>
                        </div>

                        <p className="mt-1 text-[12px] text-muted">
                          Владелец: <b>{client.ownerName}</b> ({client.ownerEmail}
                          {client.ownerPhone ? ` · ${client.ownerPhone}` : ""})
                        </p>

                        <div className="mt-2.5 flex flex-wrap gap-2 text-[11.5px]">
                          <span className="rounded-lg bg-paper px-2.5 py-1 font-medium">
                            Сотрудники: <b>{client.staffCount}</b> из{" "}
                            <b>{client.customStaffLimit ?? 8}</b>
                          </span>
                          <span className="rounded-lg bg-paper px-2.5 py-1 font-medium">
                            Людей / клиентов: <b>{client.clientsCount}</b> из{" "}
                            <b>{client.customClientLimit ?? 500}</b>
                          </span>
                          <span className="rounded-lg bg-paper px-2.5 py-1 font-medium">
                            Цена тарифа: <b>{formatMoney(price)}</b>
                          </span>
                          <span className="rounded-lg bg-mint/10 px-2.5 py-1 font-semibold text-mint">
                            Ваша доля ({provider.commissionPercent}%): {formatMoney(myShare)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={`/${client.businessSlug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-ghost h-9 px-3 text-[12px]"
                        >
                          <ExternalLink size={13} /> Сайт клиента
                        </a>
                        <button
                          type="button"
                          onClick={() =>
                            setEditingClientId(isEditing ? null : client.businessId)
                          }
                          className="btn btn-secondary h-9 gap-1.5 px-3.5 text-[12px]"
                        >
                          <Settings2 size={14} />
                          {isEditing ? "Свернуть" : "Кастомизировать подписку"}
                        </button>
                      </div>
                    </div>

                    {isEditing && (
                      <form
                        action={customizeAction}
                        className="mt-4 space-y-4 border-t border-line pt-4"
                      >
                        <input type="hidden" name="businessId" value={client.businessId} />
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <label className="label-base">Лимит сотрудников</label>
                            <input
                              name="customStaffLimit"
                              type="number"
                              min={1}
                              max={500}
                              defaultValue={client.customStaffLimit ?? 5}
                              className="input-base h-10"
                            />
                          </div>
                          <div>
                            <label className="label-base">Лимит людей (клиентов)</label>
                            <input
                              name="customClientLimit"
                              type="number"
                              min={10}
                              max={100000}
                              defaultValue={client.customClientLimit ?? 500}
                              className="input-base h-10"
                            />
                          </div>
                          <div>
                            <label className="label-base">
                              Бесплатный триал (0 или 14–30 дней)
                            </label>
                            <input
                              name="trialDays"
                              type="number"
                              min={0}
                              max={30}
                              defaultValue={0}
                              placeholder="Например 14 или 30"
                              className="input-base h-10"
                            />
                          </div>
                          <div>
                            <label className="label-base">Ваша цена подписки (UZS)</label>
                            <input
                              name="customPriceUzs"
                              type="number"
                              min={0}
                              step={1000}
                              defaultValue={price}
                              className="input-base h-10 font-semibold"
                            />
                          </div>
                          <div className="sm:col-span-2 lg:col-span-4">
                            <label className="label-base">
                              Новый пароль клиента (оставьте пустым, если не меняете)
                            </label>
                            <input
                              name="newOwnerPassword"
                              type="password"
                              minLength={6}
                              placeholder="Минимум 6 символов для сброса пароля владельца салона"
                              className="input-base h-10"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <label className="flex items-center gap-2 text-[12px] font-medium">
                            <input
                              type="checkbox"
                              name="createPaymentRequest"
                              value="true"
                              defaultChecked
                              className="size-4 accent-brand"
                            />
                            <span>Отправить обновлённый счёт / заявку на подтверждение оплаты</span>
                          </label>

                          <button
                            type="submit"
                            disabled={customizePending}
                            className="btn btn-primary h-9 px-4 text-[12px]"
                          >
                            Сохранить условия подписки
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
