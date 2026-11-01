"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CreditCard,
  Handshake,
  KeyRound,
  Percent,
  Plus,
  Settings2,
  UserPlus,
  X,
} from "lucide-react";
import {
  createOrApproveProviderAction,
  declineProviderApplicationAction,
  updateProviderSettingsAction,
  type ProviderActionState,
} from "@/server/actions/providers";
import { formatMoney } from "@/lib/plans";

export type ProviderApplicationItem = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  telegram: string | null;
  city: string | null;
  payoutCard: string | null;
  experienceNote: string | null;
  status: string;
  createdAt: string;
};

export type AdminProviderItem = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  phone: string | null;
  commissionPercent: number;
  payoutCard: string | null;
  createdAt: string;
  connectedBusinesses: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    customStaffLimit: number | null;
    customClientLimit: number | null;
    customPriceUzs: number | null;
    trialEndsAt: string | null;
  }[];
  totalPlatformRevenue: number;
  totalProviderPayout: number;
  pendingPayout: number;
};

export function ProviderManager({
  canManage,
  applications,
  providers,
}: {
  canManage: boolean;
  applications: ProviderApplicationItem[];
  providers: AdminProviderItem[];
}) {
  const router = useRouter();
  const [selectedApp, setSelectedApp] = useState<ProviderApplicationItem | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [commissionValue, setCommissionValue] = useState(60);
  const [isDeclining, startDecline] = useTransition();

  const [createState, createAction, createPending] = useActionState<
    ProviderActionState,
    FormData
  >(createOrApproveProviderAction, null);

  const [updateState, updateAction, updatePending] = useActionState<
    ProviderActionState,
    FormData
  >(updateProviderSettingsAction, null);

  const pendingApps = applications.filter((a) => a.status === "PENDING");

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      {(createState?.message || updateState?.message) && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-medium text-emerald-950">
          ✅ {createState?.message || updateState?.message}
        </div>
      )}

      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-line bg-white p-4 sm:p-5">
        <div>
          <h2 className="text-[16px] font-semibold">
            Оформление провайдеров (никнейм, пароль и % выплаты)
          </h2>
          <p className="mt-0.5 text-[12px] text-muted">
            Вы создаёте провайдеру логин (никнейм) и пароль, а также сами указываете его процент
            (по умолчанию 60% на личную карту).
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => {
              setSelectedApp(null);
              setCommissionValue(60);
              setShowManualForm((v) => !v);
            }}
            className="btn btn-primary h-10 gap-1.5 px-4 text-[12.5px]"
          >
            <Plus size={15} />
            {showManualForm ? "Скрыть форму" : "Создать провайдера вручную"}
          </button>
        )}
      </div>

      {/* CREATE / APPROVE PROVIDER MODAL OR INLINE FORM */}
      {canManage && (showManualForm || selectedApp) && (
        <div className="rounded-[24px] border-2 border-brand/40 bg-white p-5 shadow-soft sm:p-6">
          <div className="flex items-start justify-between gap-3 border-b border-line pb-3.5">
            <div>
              <span className="badge">
                <UserPlus size={12} />{" "}
                {selectedApp ? "Одобрение спец-заявки" : "Новый провайдер"}
              </span>
              <h3 className="mt-1.5 text-[18px] font-semibold">
                {selectedApp
                  ? `Оформить провайдера: ${selectedApp.fullName}`
                  : "Создать аккаунт провайдера"}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedApp(null);
                setShowManualForm(false);
              }}
              className="grid size-8 place-items-center rounded-lg bg-paper text-muted hover:text-ink"
            >
              <X size={16} />
            </button>
          </div>

          <form
            key={selectedApp?.id ?? "manual"}
            action={createAction}
            className="mt-4 space-y-4"
          >
            {selectedApp && (
              <input type="hidden" name="applicationId" value={selectedApp.id} />
            )}

            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="label-base">Имя провайдера *</label>
                <input
                  name="name"
                  required
                  defaultValue={selectedApp?.fullName ?? ""}
                  placeholder="Рустам Алимов"
                  className="input-base"
                />
              </div>
              <div>
                <label className="label-base">Никнейм для входа (логин) *</label>
                <input
                  name="username"
                  required
                  defaultValue={
                    selectedApp?.telegram
                      ? selectedApp.telegram.replace(/^@/, "").toLowerCase()
                      : ""
                  }
                  placeholder="provider_rustam"
                  className="input-base font-mono"
                />
              </div>
              <div>
                <label className="label-base">Пароль для входа *</label>
                <input
                  name="password"
                  type="text"
                  required
                  minLength={6}
                  placeholder="Минимум 6 символов"
                  className="input-base font-mono"
                />
              </div>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="label-base">
                  Сколько процентов получать провайдеру (%) *
                </label>
                <input
                  name="commissionPercent"
                  type="number"
                  min={0}
                  max={100}
                  value={commissionValue}
                  onChange={(e) => setCommissionValue(Number(e.target.value) || 0)}
                  className="input-base font-semibold text-brand"
                />
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {[40, 50, 60, 70, 80].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setCommissionValue(pct)}
                      className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                        commissionValue === pct
                          ? "border-brand bg-brand text-white"
                          : "border-line bg-paper text-ink"
                      }`}
                    >
                      {pct}% {pct === 60 ? "(Стандарт)" : ""}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label-base">Карта провайдера для выплат</label>
                <input
                  name="payoutCard"
                  defaultValue={selectedApp?.payoutCard ?? ""}
                  placeholder="8600 / 9860 •••• •••• ••••"
                  className="input-base"
                />
              </div>

              <div>
                <label className="label-base">Телефон / Email</label>
                <input
                  name="phone"
                  defaultValue={selectedApp?.phone ?? ""}
                  placeholder="+998 90 123 45 67"
                  className="input-base"
                />
                <input
                  type="hidden"
                  name="email"
                  value={selectedApp?.email ?? ""}
                />
              </div>
            </div>

            {createState?.error && (
              <div className="rounded-xl border border-rose/20 bg-rose/5 px-3.5 py-2.5 text-[12.5px] text-rose">
                {createState.error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="submit"
                disabled={createPending}
                className="btn btn-primary h-10 px-5 text-[12.5px]"
              >
                <Check size={15} />{" "}
                {createPending
                  ? "Создаём..."
                  : `Подтвердить и выдать доступ (${commissionValue}%)`}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SECTION 1: INCOMING APPLICATIONS */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Handshake size={16} className="text-brand" />
          <h2 className="text-[15px] font-semibold">
            Спец-заявки на роль провайдера с сайта ({pendingApps.length} новых)
          </h2>
        </div>

        {pendingApps.length === 0 ? (
          <div className="rounded-2xl border border-line bg-white px-4 py-6 text-center text-[12.5px] text-muted">
            Новых заявок на роль провайдера пока нет.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {pendingApps.map((app) => (
              <div
                key={app.id}
                className="rounded-2xl border border-amber-300/70 bg-white p-4 shadow-2xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[14.5px] font-semibold">{app.fullName}</p>
                    <p className="mt-0.5 text-[12px] text-muted">
                      📞 {app.phone}
                      {app.telegram ? ` · TG: ${app.telegram}` : ""}
                      {app.city ? ` · ${app.city}` : ""}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber/15 px-2.5 py-0.5 text-[10px] font-semibold text-amber">
                    Ожидает решения
                  </span>
                </div>

                {app.payoutCard && (
                  <p className="mt-2 text-[11.5px] text-ink-soft">
                    💳 Карта: <span className="font-mono">{app.payoutCard}</span>
                  </p>
                )}
                {app.experienceNote && (
                  <p className="mt-2 rounded-xl bg-paper p-2.5 text-[12px] text-ink-soft">
                    «{app.experienceNote}»
                  </p>
                )}

                {canManage && (
                  <div className="mt-3 flex items-center gap-2 pt-2 border-t border-line/60">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedApp(app);
                        setCommissionValue(60);
                        setShowManualForm(false);
                      }}
                      className="btn btn-primary h-9 flex-1 text-[12px]"
                    >
                      <KeyRound size={13} /> Выдать никнейм, пароль и %
                    </button>
                    <button
                      type="button"
                      disabled={isDeclining}
                      onClick={() => {
                        startDecline(async () => {
                          await declineProviderApplicationAction(app.id);
                          router.refresh();
                        });
                      }}
                      className="btn btn-ghost h-9 px-3 text-[12px] text-rose"
                    >
                      Отклонить
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: ACTIVE PROVIDERS LIST */}
      <div className="space-y-3">
        <h2 className="px-1 text-[15px] font-semibold">
          Действующие провайдеры ({providers.length})
        </h2>

        {providers.length === 0 ? (
          <div className="rounded-2xl border border-line bg-white px-4 py-10 text-center text-[12.5px] text-muted">
            Провайдеров пока нет. Одобрите заявку выше или нажмите «Создать провайдера вручную».
          </div>
        ) : (
          <div className="space-y-3">
            {providers.map((prov) => {
              const isEditing = editingProviderId === prov.id;

              return (
                <div
                  key={prov.id}
                  className="rounded-[22px] border border-line bg-white p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[15.5px] font-semibold">{prov.name}</span>
                        <span className="rounded-lg bg-brand-soft px-2 py-0.5 font-mono text-[11.5px] font-semibold text-brand-dark">
                          логин: {prov.username || prov.email}
                        </span>
                        <span className="rounded-full bg-mint/15 px-2.5 py-0.5 text-[11px] font-bold text-mint">
                          Ставка: {prov.commissionPercent}%
                        </span>
                      </div>

                      <p className="mt-1 text-[12px] text-muted">
                        {prov.phone ? `📞 ${prov.phone} · ` : ""}
                        💳 Карта для выплат:{" "}
                        <b className="font-mono text-ink">
                          {prov.payoutCard || "не указана"}
                        </b>
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2 text-[11.5px]">
                        <span className="rounded-xl bg-paper px-3 py-1.5">
                          Подключено салонов: <b>{prov.connectedBusinesses.length}</b>
                        </span>
                        <span className="rounded-xl bg-paper px-3 py-1.5">
                          Получено вами (100%):{" "}
                          <b>{formatMoney(prov.totalPlatformRevenue)}</b>
                        </span>
                        <span className="rounded-xl bg-mint/10 px-3 py-1.5 font-semibold text-mint">
                          К выплате провайдеру ({prov.commissionPercent}%):{" "}
                          {formatMoney(prov.totalProviderPayout)}
                        </span>
                        {prov.pendingPayout > 0 && (
                          <span className="rounded-xl bg-amber/10 px-3 py-1.5 font-semibold text-amber">
                            Ожидает в заявках: {formatMoney(prov.pendingPayout)}
                          </span>
                        )}
                      </div>
                    </div>

                    {canManage && (
                      <button
                        type="button"
                        onClick={() =>
                          setEditingProviderId(isEditing ? null : prov.id)
                        }
                        className="btn btn-secondary h-9 gap-1.5 px-3.5 text-[12px]"
                      >
                        <Settings2 size={14} />
                        {isEditing ? "Свернуть" : "Изменить % / пароль / карту"}
                      </button>
                    )}
                  </div>

                  {/* Connected Salons Mini-List */}
                  {prov.connectedBusinesses.length > 0 && (
                    <div className="mt-3.5 border-t border-line/60 pt-3">
                      <p className="mb-2 text-[11px] font-semibold tracking-wider text-muted uppercase">
                        Подключённые этим провайдером салоны:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {prov.connectedBusinesses.map((biz) => (
                          <div
                            key={biz.id}
                            className="rounded-xl border border-line bg-paper/60 px-3 py-1.5 text-[11.5px]"
                          >
                            <b>{biz.name}</b> (/{biz.slug}) ·{" "}
                            {biz.customStaffLimit ?? 8} сотр. ·{" "}
                            {biz.customClientLimit ?? 500} кл. ·{" "}
                            <b>
                              {biz.customPriceUzs
                                ? formatMoney(biz.customPriceUzs)
                                : biz.plan}
                            </b>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Inline Edit Form for Provider Settings */}
                  {canManage && isEditing && (
                    <form
                      action={updateAction}
                      className="mt-4 space-y-3 border-t border-line pt-4"
                    >
                      <input type="hidden" name="providerId" value={prov.id} />
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <label className="label-base">Никнейм для входа</label>
                          <input
                            name="username"
                            defaultValue={prov.username ?? ""}
                            className="input-base h-10 font-mono text-[12.5px]"
                          />
                        </div>
                        <div>
                          <label className="label-base">Процент провайдера (%)</label>
                          <input
                            name="commissionPercent"
                            type="number"
                            min={0}
                            max={100}
                            defaultValue={prov.commissionPercent}
                            className="input-base h-10 font-semibold text-brand"
                          />
                        </div>
                        <div>
                          <label className="label-base">Карта для выплат</label>
                          <input
                            name="payoutCard"
                            defaultValue={prov.payoutCard ?? ""}
                            placeholder="8600 •••• •••• ••••"
                            className="input-base h-10"
                          />
                        </div>
                        <div>
                          <label className="label-base">
                            Новый пароль (оставьте пустым, если не меняете)
                          </label>
                          <input
                            name="newPassword"
                            type="text"
                            placeholder="Новый пароль..."
                            className="input-base h-10 font-mono text-[12.5px]"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={updatePending}
                          className="btn btn-primary h-9 px-4 text-[12px]"
                        >
                          Сохранить настройки провайдера
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
    </div>
  );
}
