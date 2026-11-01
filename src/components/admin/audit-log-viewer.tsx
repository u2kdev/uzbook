"use client";

import { useMemo, useState } from "react";
import {
  Handshake,
  ScrollText,
  Search,
  ShieldCheck,
  Store,
  UserRound,
} from "lucide-react";

export type AuditLogItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
  createdAt: string;
  actorName: string | null;
  actorEmail: string | null;
  actorUsername: string | null;
  actorRole: string | null;
  businessName: string | null;
};

const ACTION_TITLE: Record<string, string> = {
  "auth.register": "Регистрация нового аккаунта",
  "auth.login": "Вход в систему",
  "business.created": "Создан новый салон",
  "business.status_changed": "Изменён статус салона",
  "business.plan_changed": "Изменён тариф салона администратором",
  "business.trial_extended": "Продлён пробный период салона",
  "subscription.approved": "Подтверждена оплата подписки",
  "subscription.declined": "Отклонена заявка на подписку",
  "user.role_changed": "Изменена роль пользователя",
  "provider.application_submitted": "Подана спец-заявка на роль Провайдера",
  "provider.client_connected": "Провайдер подключил новый салон (клиента)",
  "provider.subscription_customized": "Провайдер кастомизировал подписку салона",
  "provider.card_updated": "Провайдер обновил реквизиты своей карты",
  "admin.provider_created": "Админ оформил провайдера (выдал никнейм, пароль и %)",
  "admin.provider_updated": "Админ изменил настройки/процент провайдера",
  "admin.provider_application_declined": "Админ отклонил заявку на провайдера",
  "admin.logo_added": "Добавлен PNG-логотип в карусель «Нам доверяют»",
  "admin.logo_toggled": "Изменена видимость логотипа в карусели",
  "admin.logo_deleted": "Удалён логотип из карусели",
  "salon.service_created": "Салон добавил новую услугу",
  "salon.staff_created": "Салон добавил нового мастера",
  "salon.booking_created": "Новая онлайн-запись клиента в салон",
  "salon.manual_booking_created": "Салон создал запись вручную",
  "salon.booking_confirmed": "Салон подтвердил запись",
  "salon.booking_cancelled": "Салон отменил запись",
  "salon.booking_completed": "Салон завершил визит клиента",
  "salon.booking_no_show": "Отметка «Клиент не пришёл»",
  "salon.profile_updated": "Салон обновил профиль и настройки",
  "salon.subscription_requested": "Салон отправил запрос на подключение тарифа",
};

const LOG_TABS = [
  { id: "ALL", label: "Все логи платформы", icon: ScrollText },
  { id: "PROVIDERS", label: "Что делают провайдеры", icon: Handshake },
  { id: "SALONS", label: "Какой салон что делает", icon: Store },
  { id: "ADMINS", label: "Админы и саппорты", icon: ShieldCheck },
] as const;

export function AuditLogViewer({ logs }: { logs: AuditLogItem[] }) {
  const [category, setCategory] = useState<"ALL" | "PROVIDERS" | "SALONS" | "ADMINS">("ALL");
  const [selectedSalon, setSelectedSalon] = useState<string>("ALL");
  const [selectedProvider, setSelectedProvider] = useState<string>("ALL");
  const [query, setQuery] = useState("");

  const salonNames = useMemo(() => {
    const set = new Set<string>();
    for (const l of logs) {
      if (l.businessName) set.add(l.businessName);
    }
    return [...set].sort();
  }, [logs]);

  const providerNames = useMemo(() => {
    const set = new Set<string>();
    for (const l of logs) {
      if (l.actorRole === "PROVIDER" && l.actorName) {
        set.add(l.actorName);
      } else if (typeof l.details.providerName === "string") {
        set.add(l.details.providerName);
      }
    }
    return [...set].sort();
  }, [logs]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();

    return logs.filter((item) => {
      const isProviderLog =
        item.actorRole === "PROVIDER" || item.action.startsWith("provider.");
      const isSalonLog =
        item.action.startsWith("salon.") ||
        item.action === "business.created" ||
        (item.actorRole === "OWNER" && Boolean(item.businessName));
      const isAdminLog =
        item.actorRole === "ADMIN" ||
        item.actorRole === "SUPPORT" ||
        item.action.startsWith("admin.") ||
        item.action.startsWith("subscription.") ||
        item.action === "user.role_changed";

      if (category === "PROVIDERS" && !isProviderLog) return false;
      if (category === "SALONS" && !isSalonLog) return false;
      if (category === "ADMINS" && !isAdminLog) return false;

      if (selectedSalon !== "ALL" && item.businessName !== selectedSalon) {
        return false;
      }

      if (selectedProvider !== "ALL") {
        const pName =
          item.actorRole === "PROVIDER"
            ? item.actorName
            : typeof item.details.providerName === "string"
            ? item.details.providerName
            : null;
        if (pName !== selectedProvider) return false;
      }

      if (!search) return true;

      const textBlob = [
        item.action,
        ACTION_TITLE[item.action] ?? "",
        item.actorName ?? "",
        item.actorEmail ?? "",
        item.actorUsername ?? "",
        item.businessName ?? "",
        JSON.stringify(item.details),
      ]
        .join(" ")
        .toLowerCase();

      return textBlob.includes(search);
    });
  }, [logs, category, selectedSalon, selectedProvider, query]);

  return (
    <div className="space-y-4">
      {/* Category Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-line bg-white p-1.5">
          {LOG_TABS.map((tab) => {
            const active = category === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setCategory(tab.id);
                  setSelectedSalon("ALL");
                  setSelectedProvider("ALL");
                }}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12px] font-semibold transition-all ${
                  active
                    ? "bg-ink text-white shadow-xs"
                    : "text-ink-soft hover:bg-paper"
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Specific Salon Filter */}
          {salonNames.length > 0 && (
            <select
              value={selectedSalon}
              onChange={(e) => setSelectedSalon(e.target.value)}
              className="h-10 rounded-xl border border-line bg-white px-3 text-[12px] font-medium outline-none"
            >
              <option value="ALL">Все салоны ({salonNames.length})</option>
              {salonNames.map((name) => (
                <option key={name} value={name}>
                  Салон: {name}
                </option>
              ))}
            </select>
          )}

          {/* Specific Provider Filter */}
          {providerNames.length > 0 && (
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="h-10 rounded-xl border border-line bg-white px-3 text-[12px] font-medium outline-none"
            >
              <option value="ALL">Все провайдеры ({providerNames.length})</option>
              {providerNames.map((name) => (
                <option key={name} value={name}>
                  Провайдер: {name}
                </option>
              ))}
            </select>
          )}

          <label className="flex h-10 items-center gap-2 rounded-full border border-line bg-white px-3.5 sm:w-64">
            <Search size={14} className="text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по логам..."
              className="min-w-0 flex-1 bg-transparent text-[12px] outline-none"
            />
          </label>
        </div>
      </div>

      {/* Logs Feed */}
      <div className="overflow-hidden rounded-[22px] border border-line bg-white">
        {filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-[13px] text-muted">
            Записей в логах по выбранному фильтру пока нет.
          </div>
        ) : (
          filtered.map((item, idx) => {
            const title = ACTION_TITLE[item.action] ?? item.action;
            const d = item.details;

            return (
              <div
                key={item.id}
                className={`flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between ${
                  idx > 0 ? "border-t border-line/70" : ""
                }`}
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                        item.action.startsWith("provider.")
                          ? "bg-mint/15 text-mint"
                          : item.action.startsWith("salon.")
                          ? "bg-brand-soft text-brand-dark"
                          : "bg-ink text-white"
                      }`}
                    >
                      {item.action.startsWith("provider.")
                        ? "Провайдер"
                        : item.action.startsWith("salon.")
                        ? "Салон"
                        : item.actorRole ?? "Система"}
                    </span>

                    <p className="text-[13.5px] font-semibold text-ink">{title}</p>

                    {item.businessName && (
                      <span className="rounded-full bg-paper px-2.5 py-0.5 text-[11px] font-semibold text-ink-soft ring-1 ring-line">
                        🏢 {item.businessName}
                      </span>
                    )}
                  </div>

                  {/* Actor & readable details */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted">
                    <span className="inline-flex items-center gap-1">
                      <UserRound size={12} />
                      Кто:{" "}
                      <b className="text-ink-soft">
                        {item.actorName ||
                          (typeof d.fullName === "string" ? d.fullName : "Гость / Система")}
                      </b>
                      {item.actorUsername ? ` (@${item.actorUsername})` : ""}
                      {item.actorEmail ? ` <${item.actorEmail}>` : ""}
                    </span>

                    {typeof d.customStaffLimit === "number" && (
                      <span>· Сотрудников: <b>{d.customStaffLimit}</b></span>
                    )}
                    {typeof d.customClientLimit === "number" && (
                      <span>· Людей: <b>{d.customClientLimit}</b></span>
                    )}
                    {typeof d.trialDays === "number" && d.trialDays > 0 && (
                      <span>· Бесплатно: <b>{d.trialDays} дн.</b></span>
                    )}
                    {typeof d.customPriceUzs === "number" && (
                      <span>
                        · Цена: <b>{Number(d.customPriceUzs).toLocaleString("ru-RU")} сум</b>
                      </span>
                    )}
                    {typeof d.providerPayoutAmount === "number" && d.providerPayoutAmount > 0 && (
                      <span className="font-semibold text-mint">
                        · Доля провайдера ({String(d.commissionPercent ?? 60)}%):{" "}
                        {Number(d.providerPayoutAmount).toLocaleString("ru-RU")} сум
                      </span>
                    )}
                    {typeof d.clientName === "string" && (
                      <span>
                        · Клиент записи: <b>{d.clientName}</b>
                        {typeof d.serviceName === "string" ? ` (${d.serviceName})` : ""}
                      </span>
                    )}
                    {typeof d.staffName === "string" && (
                      <span>· Мастер: <b>{d.staffName}</b></span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-right text-[11px] text-muted">
                  {new Intl.DateTimeFormat("ru-RU", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(item.createdAt))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
